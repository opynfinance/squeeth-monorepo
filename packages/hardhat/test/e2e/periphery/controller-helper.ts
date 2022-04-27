// mainnet fork tests
// in 1 terminal: npx hardhat node --fork https://mainnet.infura.io/v3/infura_key --fork-block-number 14345140 --no-deploy --network hardhat
// in 2 terminal: MAINNET_FORK=true npx hardhat test ./test/e2e/periphery/controller-helper.ts
import { ethers, network} from "hardhat"
import { expect } from "chai";
import { Contract, BigNumber, providers, BytesLike, BigNumberish } from "ethers";
import BigNumberJs from 'bignumber.js'

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { WETH9, MockErc20, ShortPowerPerp, Controller, Oracle, WPowerPerp, ControllerHelper , INonfungiblePositionManager, VaultLibTester} from "../../../typechain";
import { deployUniswapV3, deploySqueethCoreContracts, deployWETHAndDai, addWethDaiLiquidity, addSqueethLiquidity } from '../../setup'
import { isSimilar, wmul, wdiv, one, oracleScaleFactor, getNow } from "../../utils"
import { JsonRpcSigner } from "@ethersproject/providers";

import {
  abi as POSITION_MANAGER_ABI,
  bytecode as POSITION_MANAGER_BYTECODE,
} from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'
import {
  abi as FACTORY_ABI,
  bytecode as FACTORY_BYTECODE,
} from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'
import {
  abi as ROUTER_ABI,
  bytecode as ROUTER_BYTECODE,
} from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json'
import {
  abi as POOL_ABI,
  bytecode as POOL_BYTECODE,
} from '@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json'
import {
  abi as LIQUIDITY_ABI,
  bytecode as LIQUIDITY_BYTECODE,
} from '@uniswap/v3-periphery/artifacts/contracts/libraries/LiquidityAmounts.sol/LiquidityAmounts.json'
import { Libraries } from "hardhat/types";

BigNumberJs.set({EXPONENTIAL_AT: 30})

const impersonateAddress = async (address: string) => {
  const hre = require('hardhat');
  await hre.network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  });
  let signer: any;
  signer = await ethers.provider.getSigner(address);
  signer.address = signer._address;
  signer._signer = signer;
  return signer;
};

describe("ControllerHelper: mainnet fork", function () {
  if (!process.env.MAINNET_FORK) return;

  let provider: providers.JsonRpcProvider;
  let owner: SignerWithAddress;
  let depositor: SignerWithAddress;
  // let depositor: JsonRpcSigner
  let feeRecipient: SignerWithAddress;
  let usdc: Contract
  let weth: Contract
  let positionManager: Contract
  let uniswapFactory: Contract
  let uniswapRouter: Contract
  let oracle: Oracle
  let controller: Controller
  let wSqueethPool: Contract
  let wSqueeth: WPowerPerp
  let ethUsdcPool: Contract
  let controllerHelper: ControllerHelper
  let shortSqueeth: ShortPowerPerp
  let liquidityAmount: Libraries
  let vaultLib: VaultLibTester



  this.beforeAll("Setup mainnet fork contracts", async () => {
    depositor = await impersonateAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
    owner = await impersonateAddress("0x8d12A197cB00D4747a1fe03395095ce2A5CC6819");

    // const usdcContract = await ethers.getContractFactory("MockErc20")
    usdc = await ethers.getContractAt("MockErc20", "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")
    // const wethContract = await ethers.getContractFactory("WETH9")
    // weth = await wethContract.attach("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2")
    weth = await ethers.getContractAt("WETH9", "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2");

    positionManager = await ethers.getContractAt(POSITION_MANAGER_ABI, "0xC36442b4a4522E871399CD717aBDD847Ab11FE88");
    uniswapFactory = await ethers.getContractAt(FACTORY_ABI, "0x1F98431c8aD98523631AE4a59f267346ea31F984");
    uniswapRouter = await ethers.getContractAt(ROUTER_ABI, "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45");

    controller = (await ethers.getContractAt("Controller", "0x64187ae08781B09368e6253F9E94951243A493D5")) as Controller
    wSqueeth = (await ethers.getContractAt("WPowerPerp", "0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B")) as WPowerPerp
    oracle = (await ethers.getContractAt("Oracle", "0x65D66c76447ccB45dAf1e8044e918fA786A483A1")) as Oracle
    shortSqueeth = (await ethers.getContractAt("ShortPowerPerp", "0xa653e22A963ff0026292Cc8B67941c0ba7863a38")) as ShortPowerPerp
    wSqueethPool = await ethers.getContractAt(POOL_ABI, "0x82c427AdFDf2d245Ec51D8046b41c4ee87F0d29C")
    // ethDaiPool = await ethers.getContractAt("MockErc20", "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8")
    ethUsdcPool = await ethers.getContractAt(POOL_ABI, "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8");

    const SqrtPriceExternal = await ethers.getContractFactory("SqrtPriceMathPartial")
    const SqrtPriceExternalLibrary = (await SqrtPriceExternal.deploy());

    const TickMathExternal = await ethers.getContractFactory("TickMathExternal")
    const TickMathLibrary = (await TickMathExternal.deploy());

    const VaultTester = await ethers.getContractFactory("VaultLibTester", {libraries: {TickMathExternal: TickMathLibrary.address, SqrtPriceMathPartial: SqrtPriceExternalLibrary.address}});
    vaultLib = (await VaultTester.deploy()) as VaultLibTester;


    const ControllerHelperUtil = await ethers.getContractFactory("ControllerHelperUtil")
    const ControllerHelperUtilLib = (await ControllerHelperUtil.deploy());
    const ControllerHelperContract = await ethers.getContractFactory("ControllerHelper", {libraries: {ControllerHelperUtil: ControllerHelperUtilLib.address}});
    controllerHelper = (await ControllerHelperContract.deploy(controller.address, positionManager.address, uniswapFactory.address, "0x59828FdF7ee634AaaD3f58B19fDBa3b03E2D9d80", "0x27182842E098f60e3D576794A5bFFb0777E025d3", "0x62e28f054efc24b26A794F5C1249B6349454352C")) as ControllerHelper;
  })

  describe("Flash mint short position, LP and use LP as collateral", async () => {
    it("open short, mint, LP oSQTH + ETH, deposit LP NFT and withdraw ETH collateral", async ()=> {
      const vaultId = (await shortSqueeth.nextId());
      const normFactor = await controller.getExpectedNormalizationFactor()
      const mintWSqueethAmount = ethers.utils.parseUnits('30')
      const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralToMint = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
      const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 420, true)
      const collateralToLp = mintWSqueethAmount.mul(squeethPrice).div(one)
      const flashloanFee = collateralToMint.mul(9).div(1000)
      const flashloanWMintDepositNftParams = {
        vaultId: 0,
        wPowerPerpAmount: mintWSqueethAmount.toString(),
        collateralToDeposit: BigNumber.from(0),
        collateralToFlashloan: collateralToMint.toString(),
        collateralToLp: collateralToLp.toString(),
        collateralToWithdraw: 0,
        lpAmount0Min: 0,
        lpAmount1Min: 0,
        lpLowerTick: -887220,
        lpUpperTick: 887220
      }

      await controllerHelper.connect(depositor).flashloanWMintDepositNft(flashloanWMintDepositNftParams, {value: collateralToLp.add(ethers.utils.parseUnits('0.01').add(flashloanFee))})

      const vaultAfter = await controller.vaults(vaultId)
      const tokenIndexAfter = await (positionManager as INonfungiblePositionManager).totalSupply();
      const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndexAfter.sub(1));
      const position = await (positionManager as INonfungiblePositionManager).positions(tokenId)

      expect(BigNumber.from(vaultAfter.NftCollateralId).eq(tokenId)).to.be.true;
      expect(position.tickLower === -887220).to.be.true
      expect(position.tickUpper === 887220).to.be.true
      expect(vaultAfter.shortAmount.sub(mintWSqueethAmount).lte(1)).to.be.true
      expect(vaultAfter.collateralAmount.eq(BigNumber.from(0))).to.be.true
    })

    describe("open short in already overcollateralized vault, mint, LP oSQTH only, deposit LP NFT", async ()=> {
      before(async () => {
        const normFactor = await controller.getExpectedNormalizationFactor()
        const mintWSqueethAmountToLp : BigNumber = ethers.utils.parseUnits('35')
        const mintRSqueethAmount = mintWSqueethAmountToLp.mul(normFactor).div(one)
        const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
        const scaledEthPrice = ethPrice.div(10000)
        const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
        const collateralAmount = debtInEth.mul(3)
  
        await controller.connect(depositor).mintWPowerPerpAmount(0, mintWSqueethAmountToLp, 0, {value: collateralAmount})  
      })

      it("mint short, LP and use it as collateral", async () => {
        const vaultId = (await shortSqueeth.nextId()).sub(1);
        await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address);

        const mintWSqueethAmount = ethers.utils.parseUnits('5')
        const collateralToMint = BigNumber.from(0)
        const collateralToLp = BigNumber.from(0)
        const flashloanWMintDepositNftParams = {
          vaultId: vaultId,
          wPowerPerpAmount: mintWSqueethAmount.toString(),
          collateralToDeposit: collateralToMint.toString(),
          collateralToFlashloan: BigNumber.from(0),
          collateralToLp: collateralToLp.toString(),
          collateralToWithdraw: 0,
          lpAmount0Min: 0,
          lpAmount1Min: 0,
          lpLowerTick: -887220,
          lpUpperTick: 0
        }

        const vaultBefore = await controller.vaults(vaultId)

        await controllerHelper.connect(depositor).flashloanWMintDepositNft(flashloanWMintDepositNftParams)

        const vaultAfter = await controller.vaults(vaultId)
        const tokenIndexAfter = await (positionManager as INonfungiblePositionManager).totalSupply();
        const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndexAfter.sub(1));
        const position = await (positionManager as INonfungiblePositionManager).positions(tokenId)

        expect(BigNumber.from(vaultAfter.NftCollateralId).eq(tokenId)).to.be.true;
        expect(position.tickLower === -887220).to.be.true
        expect(position.tickUpper === 0).to.be.true
        expect(vaultAfter.shortAmount.sub(vaultBefore.shortAmount).eq(mintWSqueethAmount)).to.be.true
        expect(vaultAfter.collateralAmount.eq(vaultBefore.collateralAmount)).to.be.true
      })
    })

    it("open short in new vault, mint, LP oSQTH only, deposit LP NFT", async () => {
      const vaultId = (await shortSqueeth.nextId());
      const normFactor = await controller.getExpectedNormalizationFactor()
      const mintWSqueethAmount = ethers.utils.parseUnits('40')
      const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralToMint = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
      const collateralToFlashloan = collateralToMint.div(2)
      const flashloanWMintDepositNftParams = {
        vaultId: 0,
        wPowerPerpAmount: mintWSqueethAmount.toString(),
        collateralToDeposit: collateralToMint.sub(collateralToFlashloan).toString(),
        collateralToFlashloan: collateralToFlashloan.toString(),
        collateralToLp: BigNumber.from(0),
        collateralToWithdraw: 0,
        lpAmount0Min: 0,
        lpAmount1Min: 0,
        lpLowerTick: -887220,
        lpUpperTick: 0
      }

      await controllerHelper.connect(depositor).flashloanWMintDepositNft(flashloanWMintDepositNftParams, {value: collateralToMint.div(2).add(ethers.utils.parseUnits('0.01'))})

      const vaultAfter = await controller.vaults(vaultId)
      const tokenIndexAfter = await (positionManager as INonfungiblePositionManager).totalSupply();
      const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndexAfter.sub(1));
      const position = await (positionManager as INonfungiblePositionManager).positions(tokenId)

      expect(BigNumber.from(vaultAfter.NftCollateralId).eq(tokenId)).to.be.true;
      expect(position.tickLower === -887220).to.be.true
      expect(position.tickUpper === 0).to.be.true
      expect(vaultAfter.shortAmount.eq(mintWSqueethAmount)).to.be.true
      expect(vaultAfter.collateralAmount.eq(collateralToMint.sub(collateralToFlashloan))).to.be.true
    })

    it("open short, mint with >0 ETH collateral, LP oSQTH + ETH, deposit LP NFT", async ()=> {
      const vaultId = (await shortSqueeth.nextId());
      const normFactor = await controller.getExpectedNormalizationFactor()
      const mintWSqueethAmount = ethers.utils.parseUnits('30')
      const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralToMint = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
      const collateralToFlashloan = collateralToMint.div(2)
      const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 420, true)
      const collateralToLp = mintWSqueethAmount.mul(squeethPrice).div(one)
      const flashloanWMintDepositNftParams = {
        vaultId: 0,
        wPowerPerpAmount: mintWSqueethAmount.toString(),
        collateralToDeposit: collateralToMint.sub(collateralToFlashloan).toString(),
        collateralToFlashloan: collateralToFlashloan.toString(),
        collateralToLp: collateralToLp.toString(),
        collateralToWithdraw: 0,
        lpAmount0Min: 0,
        lpAmount1Min: 0,
        lpLowerTick: -887220,
        lpUpperTick: 887220
      }
      console.log('test', flashloanWMintDepositNftParams)
      await controllerHelper.connect(depositor).flashloanWMintDepositNft(flashloanWMintDepositNftParams, {value: collateralToLp.add(collateralToMint.div(2)).add(ethers.utils.parseUnits('0.01'))})

      const vaultAfter = await controller.vaults(vaultId)
      const tokenIndexAfter = await (positionManager as INonfungiblePositionManager).totalSupply();
      const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndexAfter.sub(1));
      const position = await (positionManager as INonfungiblePositionManager).positions(tokenId)

      expect(BigNumber.from(vaultAfter.NftCollateralId).eq(tokenId)).to.be.true;
      expect(position.tickLower === -887220).to.be.true
      expect(position.tickUpper === 887220).to.be.true
      expect(vaultAfter.shortAmount.sub(mintWSqueethAmount).lte(1)).to.be.true
      expect(vaultAfter.collateralAmount.sub(collateralToMint.div(2)).lte(1)).to.be.true
    })

    it("existing vault, mint with >0 ETH collateral, LP oSQTH + ETH, deposit LP NFT", async ()=> {
      // New vault with 2x collateral
      const normFactor = await controller.getExpectedNormalizationFactor()
      const mintWSqueethAmount : BigNumber = ethers.utils.parseUnits('40')
      const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralToDeposit = debtInEth.mul(2)
      await controller.connect(depositor).mintWPowerPerpAmount(0, mintWSqueethAmount, 0, {value: collateralToDeposit})
      // Mint full range into vault with no added eth
      const vaultId = (await shortSqueeth.nextId()).sub(1);
      await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address)
      const vaultBefore = await controller.vaults(vaultId)
      
      const collateralToMint = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
      const collateralToFlashloan = collateralToMint.div(2)
      const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 420, true)
      const collateralToLp = mintWSqueethAmount.mul(squeethPrice).div(one)
      const flashloanWMintDepositNftParams = {
        vaultId: vaultId,
        wPowerPerpAmount: mintWSqueethAmount.toString(),
        collateralToDeposit: collateralToMint.sub(collateralToFlashloan).toString(),
        collateralToFlashloan: collateralToFlashloan.toString(),
        collateralToLp: collateralToLp.toString(),
        collateralToWithdraw: 0,
        lpAmount0Min: 0,
        lpAmount1Min: 0,
        lpLowerTick: -887220,
        lpUpperTick: 887220
      }
      console.log('test', flashloanWMintDepositNftParams)
      const tx = await controllerHelper.connect(depositor).flashloanWMintDepositNft(flashloanWMintDepositNftParams, {value: collateralToLp.add(collateralToMint)})

      const receipt = await tx.wait()
      const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice)

      const vaultAfter = await controller.vaults(vaultId)
      const tokenIndexAfter = await (positionManager as INonfungiblePositionManager).totalSupply();
      const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndexAfter.sub(1));
      const position = await (positionManager as INonfungiblePositionManager).positions(tokenId)
      console.log('collateralToMint', collateralToMint.toString())
      console.log('vaultBefore.collateralAmount', vaultBefore.collateralAmount.toString())
      console.log('vaultBefore.shortAmount', vaultBefore.shortAmount.toString())
      console.log('vaultBefore.NftCollateralId', vaultBefore.NftCollateralId.toString())
      console.log('vaultAfter.collateralAmount', vaultAfter.collateralAmount.toString())
      console.log('vaultAfter.shortAmount', vaultAfter.shortAmount.toString())
      console.log('vaultAfter.NftCollateralId', vaultAfter.NftCollateralId.toString())
      console.log('mintWSqueethAmount', mintWSqueethAmount.toString())
      //console.log('collateralToMint', collateralToMint.toString())
      console.log('gasSpent', gasSpent.toString())

      expect(BigNumber.from(vaultAfter.NftCollateralId).eq(tokenId)).to.be.true;
      expect(position.tickLower === -887220).to.be.true
      expect(position.tickUpper === 887220).to.be.true
      expect(vaultAfter.shortAmount.sub(vaultBefore.shortAmount).sub(mintWSqueethAmount).abs().lte(1)).to.be.true
      expect(vaultAfter.collateralAmount.sub(vaultBefore.collateralAmount).sub((collateralToMint.sub(collateralToFlashloan))).eq(0)).to.be.true
    })

    it("open short in new vault, mint, LP oSQTH only, deposit LP NFT, no eth added", async () => {
      // New vault with 4x collateral
      const normFactor = await controller.getExpectedNormalizationFactor()
      const mintWSqueethAmount : BigNumber = ethers.utils.parseUnits('40')
      const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralToDeposit = debtInEth.mul(4)
      await controller.connect(depositor).mintWPowerPerpAmount(0, mintWSqueethAmount, 0, {value: collateralToDeposit})


      // Mint full range into vault with no added eth
      const vaultId = (await shortSqueeth.nextId()).sub(1);
      await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address)


      const flashloanWMintDepositNftParams = {
        vaultId: vaultId.toString(),
        wPowerPerpAmount: mintWSqueethAmount.toString(),
        collateralToDeposit: BigNumber.from(0),
        collateralToFlashloan: debtInEth.toString(),
        collateralToLp: BigNumber.from(0),
        collateralToWithdraw: 0,
        lpAmount0Min: 0,
        lpAmount1Min: 0,
        lpLowerTick: -887220,
        lpUpperTick: 0
      }

      await controllerHelper.connect(depositor).flashloanWMintDepositNft(flashloanWMintDepositNftParams)

      const vaultAfter = await controller.vaults(vaultId)
      const tokenIndexAfter = await (positionManager as INonfungiblePositionManager).totalSupply();
      const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndexAfter.sub(1));
      const position = await (positionManager as INonfungiblePositionManager).positions(tokenId)


      console.log('vaultAfter.collateralAmount', vaultAfter.collateralAmount.toString())
      console.log('vaultAfter.shortAmount', vaultAfter.shortAmount.toString())
      console.log('vaultAfter.NftCollateralId', vaultAfter.NftCollateralId.toString())


      expect(BigNumber.from(vaultAfter.NftCollateralId).eq(tokenId)).to.be.true;
      expect(position.tickLower === -887220).to.be.true
      expect(position.tickUpper === 0).to.be.true
      expect(vaultAfter.shortAmount.eq(mintWSqueethAmount.mul(2))).to.be.true
      //expect(vaultAfter.collateralAmount.eq(collateralToMint.sub(collateralToFlashloan))).to.be.true
    })

    it("open short in new vault, mint, LP oSQTH only, deposit LP NFT, some eth added", async () => {
      // New vault with 1.5x collateral
      const normFactor = await controller.getExpectedNormalizationFactor()
      const mintWSqueethAmount : BigNumber = ethers.utils.parseUnits('40')
      const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralToDeposit = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
      await controller.connect(depositor).mintWPowerPerpAmount(0, mintWSqueethAmount, 0, {value: collateralToDeposit})


      // Mint full range into vault with no added eth
      const vaultId = (await shortSqueeth.nextId()).sub(1);
      await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address)


      const flashloanWMintDepositNftParams = {
        vaultId: vaultId.toString(),
        wPowerPerpAmount: mintWSqueethAmount.toString(),
        collateralToDeposit: collateralToDeposit.toString(),
        collateralToFlashloan: debtInEth.toString(),
        collateralToLp: BigNumber.from(0),
        collateralToWithdraw: 0,
        lpAmount0Min: 0,
        lpAmount1Min: 0,
        lpLowerTick: -887220,
        lpUpperTick: 0
      }

      await controllerHelper.connect(depositor).flashloanWMintDepositNft(flashloanWMintDepositNftParams, {value: collateralToDeposit})

      const vaultAfter = await controller.vaults(vaultId)
      const tokenIndexAfter = await (positionManager as INonfungiblePositionManager).totalSupply();
      const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndexAfter.sub(1));
      const position = await (positionManager as INonfungiblePositionManager).positions(tokenId)


      console.log('vaultAfter.collateralAmount', vaultAfter.collateralAmount.toString())
      console.log('vaultAfter.shortAmount', vaultAfter.shortAmount.toString())
      console.log('vaultAfter.NftCollateralId', vaultAfter.NftCollateralId.toString())


      expect(BigNumber.from(vaultAfter.NftCollateralId).eq(tokenId)).to.be.true;
      expect(position.tickLower === -887220).to.be.true
      expect(position.tickUpper === 0).to.be.true
      expect(vaultAfter.shortAmount.eq(mintWSqueethAmount.mul(2))).to.be.true
      expect(vaultAfter.collateralAmount.eq(collateralToDeposit.mul(2))).to.be.true
    })

    // it("open short, mint, LP oSQTH + ETH, deposit LP NFT and withdraw ETH collateral, no ETH added", async ()=> {
    //   // New vault with 2x collateral
    //   const normFactor = await controller.getExpectedNormalizationFactor()
    //   const mintWSqueethAmount : BigNumber = ethers.utils.parseUnits('35')
    //   const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
    //   const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
    //   const scaledEthPrice = ethPrice.div(10000)
    //   const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
    //   const collateralToDeposit = debtInEth.mul(2)
    //   await controller.connect(depositor).mintWPowerPerpAmount(0, mintWSqueethAmount, 0, {value: collateralToDeposit})


    //   // Mint full range into vault with no added eth
    //   const vaultId = (await shortSqueeth.nextId()).sub(1);

    //   //// test
    //   const vaultBefore = await controller.vaults(vaultId)
    //   console.log('vaultBefore.collateralAmount', vaultBefore.collateralAmount.toString())
    //   console.log('vaultBefore.shortAmount', vaultBefore.shortAmount.toString())
    //   console.log('vaultBefore.NftCollateralId', vaultBefore.NftCollateralId.toString())

    //   const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 420, true)
    //   const collateralToLp = mintWSqueethAmount.mul(squeethPrice).div(one)

    //   console.log('ethPrice', ethPrice.toString())
    //   console.log('squeethPrice', squeethPrice.toString())
    //   console.log('normFactor', normFactor.toString())

    //   // Operator for vault
    //   await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address)

    //   console.log('trying LP with zero eth added')
    //   const flashloanWMintDepositNftParams = {
    //     vaultId: vaultId.toString(),
    //     wPowerPerpAmount: mintWSqueethAmount.toString(),
    //     collateralToDeposit: BigNumber.from(0).toString(),
    //     collateralToFlashloan: collateralToDeposit.toString(),
    //     collateralToLp: collateralToLp.toString(),
    //     collateralToWithdraw: BigNumber.from(0).toString(), // withdraw from vault at end
    //     lpAmount0Min: 0,
    //     lpAmount1Min: 0,
    //     lpLowerTick: -887220,
    //     lpUpperTick: 887220
    //   }
    //   // const flashloanWMintDepositNftParams = {
    //   //   vaultId: 0,
    //   //   wPowerPerpAmount: mintWSqueethAmount.toString(),
    //   //   collateralToDeposit: collateralToMint.sub(collateralToFlashloan).toString(),
    //   //   collateralToFlashloan: collateralToFlashloan.toString(),
    //   //   collateralToLp: collateralToLp.toString(),
    //   //   collateralToWithdraw: 0,
    //   //   lpAmount0Min: 0,
    //   //   lpAmount1Min: 0,
    //   //   lpLowerTick: -887220,
    //   //   lpUpperTick: 887220
    //   // }

    //   console.log(flashloanWMintDepositNftParams)

    //   await controllerHelper.connect(depositor).flashloanWMintDepositNft(flashloanWMintDepositNftParams)

    //   const vaultAfter = await controller.vaults(vaultId)
    //   const tokenIndexAfter = await (positionManager as INonfungiblePositionManager).totalSupply();
    //   const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndexAfter.sub(1));
    //   const position = await (positionManager as INonfungiblePositionManager).positions(tokenId)

    //   console.log('vaultAfter.collateralAmount', vaultAfter.collateralAmount.toString())
    //   console.log('vaultAfter.shortAmount', vaultAfter.shortAmount.toString())
    //   console.log('vaultAfter.NftCollateralId', vaultAfter.NftCollateralId.toString())

    //   expect(BigNumber.from(vaultAfter.NftCollateralId).eq(tokenId)).to.be.true;
    //   expect(position.tickLower === -887220).to.be.true
    //   expect(position.tickUpper === 887220).to.be.true
    //   //expect(vaultAfter.shortAmount.sub(mintWSqueethAmount).lte(1)).to.be.true
    //   //expect(vaultAfter.collateralAmount.eq(BigNumber.from(0))).to.be.true
    // })



  })

  describe("Close LP position in vault: LP have more wPowerPerp than needed amount to burn", async () => {
    before("open first short position and LP" , async () => {
      const normFactor = await controller.getExpectedNormalizationFactor()
      const mintWSqueethAmountToLp : BigNumber = ethers.utils.parseUnits('50')
      const mintRSqueethAmount = mintWSqueethAmountToLp.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralAmount = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
      const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 420, true)
      const collateralToLp = mintWSqueethAmountToLp.mul(squeethPrice).div(one)

      await controller.connect(depositor).mintWPowerPerpAmount(0, mintWSqueethAmountToLp, 0, {value: collateralAmount})

      const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16) 
      const token0 = isWethToken0 ? weth.address : wSqueeth.address
      const token1 = isWethToken0 ? wSqueeth.address : weth.address

      const mintParam = {
        token0,
        token1,
        fee: 3000,
        tickLower: -887220,// int24 min tick used when selecting full range
        tickUpper: 887220,// int24 max tick used when selecting full range
        amount0Desired: isWethToken0 ? collateralToLp : mintWSqueethAmountToLp,
        amount1Desired: isWethToken0 ? mintWSqueethAmountToLp : collateralToLp,
        amount0Min: 0,
        amount1Min: 0,
        recipient: depositor.address,
        deadline: Math.floor(await getNow(ethers.provider) + 8640000),// uint256
      }

      await weth.connect(depositor).deposit({value: collateralToLp})
      await weth.connect(depositor).approve(positionManager.address, ethers.constants.MaxUint256)
      await wSqueeth.connect(depositor).approve(positionManager.address, ethers.constants.MaxUint256)  
      await (positionManager as INonfungiblePositionManager).connect(depositor).mint(mintParam)
    })

    before("open short amount more than amount in LP position" , async () => {
      const normFactor = await controller.getExpectedNormalizationFactor()
      const mintWSqueethAmount = ethers.utils.parseUnits('35')
      const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralAmount = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
      const tokenIndexAfter = await (positionManager as INonfungiblePositionManager).totalSupply();
      const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndexAfter.sub(1));

      await (positionManager as INonfungiblePositionManager).connect(depositor).approve(controller.address, tokenId)
      await controller.connect(depositor).mintWPowerPerpAmount(0, mintWSqueethAmount, tokenId)
    })

    it("close LP position deposited as collateral in vault", async () => {
      const vaultId = (await shortSqueeth.nextId()).sub(1);
      const uniTokenId =  (await controller.vaults(vaultId)).NftCollateralId;
      const vaultBefore = await controller.vaults(vaultId); 
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = vaultBefore.shortAmount.mul(scaledEthPrice).div(one)
      const collateralToFlashloan = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
      const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 420, true)
      const slippage = BigNumber.from(3).mul(BigNumber.from(10).pow(16))
      const limitPriceEthPerPowerPerp = squeethPrice.mul(one.sub(slippage)).div(one);
      const positionBefore = await (positionManager as INonfungiblePositionManager).positions(uniTokenId);

      const flashloanCloseVaultLpNftParam = {
        vaultId: vaultId,
        tokenId: uniTokenId,
        liquidity: positionBefore.liquidity,
        liquidityPercentage: ethers.utils.parseUnits('1'),
        wPowerPerpAmountToBurn: vaultBefore.shortAmount.toString(),
        collateralToFlashloan: collateralToFlashloan.toString(),
        collateralToWithdraw: BigNumber.from(0),
        limitPriceEthPerPowerPerp: limitPriceEthPerPowerPerp.toString(),
        amount0Min: 0,
        amount1Min: 0
      }

      await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address);
      await controllerHelper.connect(depositor).flashloanCloseVaultLpNft(flashloanCloseVaultLpNftParam);

      const positionAfter = await (positionManager as INonfungiblePositionManager).positions(uniTokenId);
      const vaultAfter = await controller.vaults(vaultId); 

      expect(positionAfter.tickLower === -887220).to.be.true
      expect(positionAfter.tickUpper === 887220).to.be.true
      expect(positionAfter.liquidity.eq(BigNumber.from(0))).to.be.true
      expect(vaultAfter.shortAmount.eq(BigNumber.from(0))).to.be.true
      expect(vaultAfter.collateralAmount.eq(BigNumber.from(0))).to.be.true
    })
  })

  describe("Close LP position in vault: LP have less wPowerPerp than needed amount to burn", async () => {
    before("open first short position and LP" , async () => {
      const normFactor = await controller.getExpectedNormalizationFactor()
      const mintWSqueethAmountToLp : BigNumber = ethers.utils.parseUnits('30')
      const mintRSqueethAmount = mintWSqueethAmountToLp.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralAmount = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
      const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 420, true)
      const collateralToLp = mintWSqueethAmountToLp.mul(squeethPrice).div(one)

      await controller.connect(depositor).mintWPowerPerpAmount(0, mintWSqueethAmountToLp, 0, {value: collateralAmount})

      const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16) 
      const token0 = isWethToken0 ? weth.address : wSqueeth.address
      const token1 = isWethToken0 ? wSqueeth.address : weth.address

      const mintParam = {
        token0,
        token1,
        fee: 3000,
        tickLower: -887220,// int24 min tick used when selecting full range
        tickUpper: 887220,// int24 max tick used when selecting full range
        amount0Desired: isWethToken0 ? collateralToLp : mintWSqueethAmountToLp,
        amount1Desired: isWethToken0 ? mintWSqueethAmountToLp : collateralToLp,
        amount0Min: 0,
        amount1Min: 0,
        recipient: depositor.address,
        deadline: Math.floor(await getNow(ethers.provider) + 8640000),// uint256
      }

      await weth.connect(depositor).deposit({value: collateralToLp})
      await weth.connect(depositor).approve(positionManager.address, ethers.constants.MaxUint256)
      await wSqueeth.connect(depositor).approve(positionManager.address, ethers.constants.MaxUint256)  
      await (positionManager as INonfungiblePositionManager).connect(depositor).mint(mintParam)
    })

    before("open short amount more than amount in LP position" , async () => {
      const normFactor = await controller.getExpectedNormalizationFactor()
      const mintWSqueethAmount = ethers.utils.parseUnits('35')
      const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralAmount = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
      const tokenIndexAfter = await (positionManager as INonfungiblePositionManager).totalSupply();
      const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndexAfter.sub(1));

      await (positionManager as INonfungiblePositionManager).connect(depositor).approve(controller.address, tokenId)
      await controller.connect(depositor).mintWPowerPerpAmount(0, mintWSqueethAmount, tokenId)
    })

    it("close LP position deposited as collateral in vault", async () => {
      const vaultId = (await shortSqueeth.nextId()).sub(1);
      const uniTokenId =  (await controller.vaults(vaultId)).NftCollateralId;
      const vaultBefore = await controller.vaults(vaultId); 
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = vaultBefore.shortAmount.mul(scaledEthPrice).div(one)
      const collateralToFlashloan = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
      const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 420, true)
      const slippage = BigNumber.from(3).mul(BigNumber.from(10).pow(16))
      const limitPriceEthPerPowerPerp = squeethPrice.mul(one.add(slippage)).div(one);
      const positionBefore = await (positionManager as INonfungiblePositionManager).positions(uniTokenId);
      const flashloanCloseVaultLpNftParam = {
        vaultId: vaultId,
        tokenId: uniTokenId,
        liquidity: positionBefore.liquidity,
        liquidityPercentage: ethers.utils.parseUnits('1'),
        wPowerPerpAmountToBurn: vaultBefore.shortAmount.toString(),
        collateralToFlashloan: collateralToFlashloan.toString(),
        collateralToWithdraw: BigNumber.from(0),
        limitPriceEthPerPowerPerp: limitPriceEthPerPowerPerp.toString(),
        amount0Min: 0,
        amount1Min: 0
      }

      await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address);
      await controllerHelper.connect(depositor).flashloanCloseVaultLpNft(flashloanCloseVaultLpNftParam, {value: ethers.utils.parseUnits('2')});

      const positionAfter = await (positionManager as INonfungiblePositionManager).positions(uniTokenId);
      const vaultAfter = await controller.vaults(vaultId); 

      expect(positionAfter.tickLower === -887220).to.be.true
      expect(positionAfter.tickUpper === 887220).to.be.true
      expect(positionAfter.liquidity.eq(BigNumber.from(0))).to.be.true
      expect(vaultAfter.shortAmount.eq(BigNumber.from(0))).to.be.true
      expect(vaultAfter.collateralAmount.eq(BigNumber.from(0))).to.be.true
    })
  })

  describe("Rebalance with vault", async () => {

    // Mint 50 squeeth in new vault
      beforeEach("Mint and LP full range" , async () => {
        const depositorEthBalanceBefore = await ethers.provider.getBalance(depositor.address)
        // Mint 50 squeeth in new vault
        const normFactor = await controller.getExpectedNormalizationFactor()
        const mintWSqueethAmount = ethers.utils.parseUnits('50')
        const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
        const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
        const scaledEthPrice = ethPrice.div(10000)
        const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
        const collateralAmount = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
        const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 1, true)
        const collateralToLp = mintWSqueethAmount.mul(squeethPrice).div(one)
        const params = {
          recipient: depositor.address,
          vaultId: 0,
          wPowerPerpAmount: mintWSqueethAmount,
          collateralToDeposit: collateralAmount,
          collateralToLp: collateralToLp,
          amount0Min: 0,
          amount1Min: 0,
          lowerTick: -887220,
          upperTick: 887220
        }
        // Batch mint new full range LP
        const tx = await controllerHelper.connect(depositor).batchMintLp(params, {value: collateralAmount.add(collateralToLp)});
        const receipt = await tx.wait()
        const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice)
        const depositorEthBalanceAfter= await ethers.provider.getBalance(depositor.address)
        console.log('target amounts')
        console.log('collateral amount', collateralAmount.toString())
        console.log('collateralToLp', collateralToLp.toString())
        console.log('wPowerPerpAmount: ', mintWSqueethAmount.toString())
        console.log('depositorEthBalanceBefore', depositorEthBalanceBefore.toString())
        console.log('depositorEthBalanceAfter', depositorEthBalanceAfter.toString())
        console.log('gasSpent', gasSpent.toString())

      })

      afterEach("Mint and LP 50 squeeth" , async () => {
        // Pull out uni token from vault
        const vaultId = (await shortSqueeth.nextId()).sub(1);
        controller.connect(depositor).withdrawUniPositionToken(vaultId)
        console.log('pull out completed');
      })
        
    it("Close vault LP and open new LP with the a different range, same amount of ETH and oSQTH", async () => {
      // Get vault and LP info
      const vaultId = (await shortSqueeth.nextId()).sub(1);
      const tokenIndex = await (positionManager as INonfungiblePositionManager).totalSupply();
      const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndex.sub(1));
      const ownerOfUniNFT = await (positionManager as INonfungiblePositionManager).ownerOf(tokenId); 
      const positionBefore = await (positionManager as INonfungiblePositionManager).positions(tokenId)
      const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16)
      // Get current LPpositions 
      await (positionManager as INonfungiblePositionManager).connect(depositor).approve(positionManager.address, tokenId); 



      const [amount0, amount1] = await (positionManager as INonfungiblePositionManager).connect(depositor).callStatic.decreaseLiquidity({
        tokenId: tokenId,
        liquidity: positionBefore.liquidity,
        amount0Min: 0,
        amount1Min: 0,
        deadline: Math.floor(await getNow(ethers.provider) + 8640000),
      })

      // const slot0Before = await wSqueethPool.slot0()
      // const currentTickBefore = slot0Before[1]
      // const [amount0_, amount1_] = await vaultLib.getAmountsForLiquidity(currentTickBefore, positionBefore.tickLower, positionBefore.tickUpper, positionBefore.liquidity)

      const vault = await controller.vaults(vaultId);

      // const wPowerPerpAmountInLPBefore1 = amount0_
      // const wethAmountInLPBefore1 = amount1_
      const wPowerPerpAmountInLPBefore = (isWethToken0) ? amount1 : amount0;
      const wethAmountInLPBefore = (isWethToken0) ? amount0 : amount1;
      console.log('wPowerPerpAmountInLPBefore', wPowerPerpAmountInLPBefore.toString())
      console.log('wethAmountInLPBefore', wethAmountInLPBefore.toString())
      // console.log('wPowerPerpAmountInLPBefore1', wPowerPerpAmountInLPBefore1.toString())
      // console.log('wethAmountInLPBefore1', wethAmountInLPBefore1.toString())
      console.log('vaultIddddddddddd', vaultId.toString())
      console.log('vault.shortAmount', vault.shortAmount.toString())
      console.log('vault.collateralAmount', vault.collateralAmount.toString())
      // console.log('tokenId', tokenId.toString())
      // console.log('wPowerPerpAmountInLP', wPowerPerpAmountInLP.toString());
      // console.log('wethAmountInLP', wethAmountInLP.toString())
      // console.log('owner of nft', ownerOfUniNFT.toString())
      // deposit nft to vault (approve first)
      await shortSqueeth.connect(depositor).approve(controller.address, vaultId);
      await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address)
      await (positionManager as INonfungiblePositionManager).connect(depositor).setApprovalForAll(controller.address, true) // approval for controller 
      await (positionManager as INonfungiblePositionManager).connect(depositor).setApprovalForAll(controllerHelper.address, true) // approve controllerHelper
      // await (positionManager as INonfungiblePositionManager).connect(depositor).setApprovalForAll(depositor.address, true) // approve depositor address

      // console.log('ControllerHelper.address', controllerHelper.address)
      // console.log('Controller address', controller.address);

      //const isControllerHelperApproved = await (positionManager as INonfungiblePositionManager).connect(depositor).callStatic.isApprovedForAll(depositor.address, controllerHelper.address)
      //await (positionManager as INonfungiblePositionManager).connect(depositor).approve(controllerHelperUtil.address, tokenId)
      //console.log('isControllerHelperApproved', isControllerHelperApproved)
      //const approvedList = await (positionManager as INonfungiblePositionManager).connect(depositor).getApproved(tokenId)
      //console.log('approvedList', approvedList.toString())
      await controller.connect(depositor).depositUniPositionToken(vaultId, tokenId)
      //console.log('sucessfully deposited uni position token')

      const vaultBefore = await controller.vaults(vaultId);
      // console.log('shortAmount',vaultBefore.shortAmount.toString());
      // console.log('collateralAmount',vaultBefore.collateralAmount.toString());
      // console.log('NftCollateralId',vaultBefore.NftCollateralId.toString());

      // Setup for mint of new LP
      const slot0 = await wSqueethPool.slot0()
      const currentTick = slot0[1]
      //const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16) 
      const amount0Min = BigNumber.from(0);
      const amount1Min = BigNumber.from(0);
      // Closest 60 tick width around current tick (60 is minimum tick width for 30bps pool)
      const newTickLower = 60*((currentTick - currentTick%60)/60 - 1)
      const newTickUpper = 60*((currentTick - currentTick%60)/60 + 1)
      console.log('Inputs for MintNewLP to encode',depositor.address.toString(), BigNumber.from(0), amount0,
      amount1, BigNumber.from(0), BigNumber.from(0), newTickLower, newTickUpper)
      console.log('currentTick', currentTick);
      console.log('amount0', amount0.toString());
      console.log('amount1', amount1.toString());
      const abiCoder = new ethers.utils.AbiCoder
      const params = [
        {
          // Remove liquidity
          rebalanceVaultNftType: BigNumber.from(1), // DecreaseLp:
          // DecreaseLiquidityParams: [tokenId, liquidity, liquidityPercentage, amount0Min, amount1Min]
          data: abiCoder.encode(["uint256", 'uint256', 'uint256', 'uint128', 'uint128'],
           [tokenId, positionBefore.liquidity, BigNumber.from(100).mul(BigNumber.from(10).pow(16)), BigNumber.from(0),BigNumber.from(0)])
          },
         {
           // Mint new LP 
           rebalanceVaultNftType:  BigNumber.from(4), // MintNewLP
           // lpWPowerPerpPool: [recipient, amount0Desired, amount1Desired, amount0Min, amount1Mint, lowerTick, upperTick ]
           data: abiCoder.encode(["address", 'uint256','uint256', 'uint256', 'uint256', 'int24', 'int24'],
            [controllerHelper.address.toString(),  amount0.toString(), amount1.toString(), amount0Min.toString(), amount1Min.toString(), newTickLower.toString(), newTickUpper.toString()])
         }

      ]
      // console.log('amount0', amount0.toString())
      // console.log('amount1', amount1.toString())
      // console.log(newTickLower)
      console.log('reached rebalance')
      const flashLoanAmount = ethers.utils.parseUnits('2')
      await controllerHelper.connect(depositor).rebalanceVaultNft(vaultId, flashLoanAmount, params);
      console.log('finished rebalance call')

      // Get new vault and LP info
      const vaultAfter = await controller.vaults(vaultId);
      const tokenIdAfter = vaultAfter.NftCollateralId;
      console.log('vaultAfter.NftCollaterald',vaultAfter.NftCollateralId.toString())
      const positionAfter = await (positionManager as INonfungiblePositionManager).positions(tokenIdAfter)
      console.log('printed positions', positionAfter)
      // const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16)
      // Get current LPpositions

      // Can't use decreaseLiquidity here because reverts with 'Not approved'. Not sure why this is the case.
      // const [amount0After, amount1After] = await (positionManager as INonfungiblePositionManager).connect(controllerHelper.address).callStatic.decreaseLiquidity({
      //   tokenId: tokenIdAfter,
      //   liquidity: positionAfter.liquidity,
      //   amount0Min: 0,
      //   amount1Min: 0,
      //   deadline: Math.floor(await getNow(ethers.provider) + 8640000),
      // })
      

      // const wPowerPerpAmountInLPAfter = (isWethToken0) ? amount1 : amount0;
      // const wethAmountInLPAfter = (isWethToken0) ? amount0 : amount1;

      // Expects
      // 
      const slot0After = await wSqueethPool.slot0()
      const currentTickAfter = slot0After[1]
      const positionAmountsAfter = await vaultLib.getUniPositionBalances(positionManager.address, tokenIdAfter, currentTickAfter, isWethToken0)

      console.log('ethAmount', positionAmountsAfter.ethAmount.toString())
      console.log('wPowerPerpAmount', positionAmountsAfter.wPowerPerpAmount.toString())
      console.log('positionBefore.liquidity',positionBefore.liquidity.toString())
      //expect(ownerOfUniNFTAfter.toString().eq(depositor.address.toString())).to.be.true
      expect(positionAfter.tickLower === newTickLower).to.be.true
      expect(positionAfter.tickUpper === newTickUpper).to.be.true
      //expect(positionAfter.liquidity.eq(BigNumber.from(0))).to.be.true
      //expect(vaultAfter.shortAmount.eq(vaultBefore.shortAmount)).to.be.true
      //expect(vaultAfter.collateralAmount.eq(vaultBefore.collateralAmount)).to.be.true
      //expect(vaultAfter.NftCollateralId==0).to.be.true      
      
      console.log('vaultAfter.shortAmount',vaultAfter.shortAmount.toString());
      console.log('vaultAfter.collateralAmount',vaultAfter.collateralAmount.toString());
      console.log('vaultAfter.NftCollateralId',vaultAfter.NftCollateralId);

    })
  })

  describe("Remove ETH from vault and increase liquidity" , async () => {
    before("open first short position and LP" , async () => {
      const normFactor = await controller.getExpectedNormalizationFactor()
      const mintWSqueethAmountToLp : BigNumber = ethers.utils.parseUnits('30')
      const mintRSqueethAmount = mintWSqueethAmountToLp.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralAmount = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01')).add(debtInEth.mul(2))
      const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 420, true)
      const collateralToLp = mintWSqueethAmountToLp.mul(squeethPrice).div(one)

      await controller.connect(depositor).mintWPowerPerpAmount(0, mintWSqueethAmountToLp, 0, {value: collateralAmount})

      const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16) 
      const token0 = isWethToken0 ? weth.address : wSqueeth.address
      const token1 = isWethToken0 ? wSqueeth.address : weth.address

      const mintParam = {
        token0,
        token1,
        fee: 3000,
        tickLower: -887220,// int24 min tick used when selecting full range
        tickUpper: 887220,// int24 max tick used when selecting full range
        amount0Desired: isWethToken0 ? collateralToLp : mintWSqueethAmountToLp,
        amount1Desired: isWethToken0 ? mintWSqueethAmountToLp : collateralToLp,
        amount0Min: 0,
        amount1Min: 0,
        recipient: depositor.address,
        deadline: Math.floor(await getNow(ethers.provider) + 8640000),// uint256
      }

      await weth.connect(depositor).deposit({value: collateralToLp})
      await weth.connect(depositor).approve(positionManager.address, ethers.constants.MaxUint256)
      await wSqueeth.connect(depositor).approve(positionManager.address, ethers.constants.MaxUint256)  
      await (positionManager as INonfungiblePositionManager).connect(depositor).mint(mintParam)
    })

    it("Withdraw collateral from vault and increase ETH in LP", async () => {
      
    })

  })
})

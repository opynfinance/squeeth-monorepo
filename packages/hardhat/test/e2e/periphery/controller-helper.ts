// mainnet fork tests
// in 1 terminal: npx hardhat node --fork https://mainnet.infura.io/v3/infura_key --fork-block-number 14345140 --no-deploy --network hardhat
// in 2 terminal: MAINNET_FORK=true npx hardhat test ./test/e2e/periphery/controller-helper.ts
import { ethers, network} from "hardhat"
import { expect } from "chai";
import { Contract, BigNumber, providers, BytesLike, BigNumberish, constants } from "ethers";
import BigNumberJs from 'bignumber.js'

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { WETH9, MockErc20, ShortPowerPerp, Controller, Oracle, WPowerPerp, ControllerHelper, INonfungiblePositionManager, SqrtPriceMathPartial} from "../../../typechain";
import { deployUniswapV3, deploySqueethCoreContracts, deployWETHAndDai, addWethDaiLiquidity, addSqueethLiquidity } from '../../setup'
import { isSimilar, wmul, wdiv, one, oracleScaleFactor, getNow } from "../../utils"

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
  abi as QUOTER_ABI,
  bytecode as QUOTER_BYTECODE,
} from "@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json"


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
  let controllerSigner: SignerWithAddress;
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
  let quoter: Contract

  this.beforeAll("Setup mainnet fork contracts", async () => {
    depositor = await impersonateAddress("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
    owner = await impersonateAddress('0xDA9dfA130Df4dE4673b89022EE50ff26f6EA73Cf');
    controllerSigner = await impersonateAddress('0x64187ae08781B09368e6253F9E94951243A493D5');
    // const usdcContract = await ethers.getContractFactory("MockErc20")
    usdc = await ethers.getContractAt("MockErc20", "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48")
    // const wethContract = await ethers.getContractFactory("WETH9")
    // weth = await wethContract.attach("0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2")
    weth = await ethers.getContractAt("WETH9", "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2");

    positionManager = await ethers.getContractAt(POSITION_MANAGER_ABI, "0xC36442b4a4522E871399CD717aBDD847Ab11FE88");
    uniswapFactory = await ethers.getContractAt(FACTORY_ABI, "0x1F98431c8aD98523631AE4a59f267346ea31F984");
    uniswapRouter = await ethers.getContractAt(ROUTER_ABI, "0xE592427A0AEce92De3Edee1F18E0157C05861564");

    controller = (await ethers.getContractAt("Controller", "0x64187ae08781B09368e6253F9E94951243A493D5")) as Controller
    wSqueeth = (await ethers.getContractAt("WPowerPerp", "0xf1B99e3E573A1a9C5E6B2Ce818b617F0E664E86B")) as WPowerPerp
    oracle = (await ethers.getContractAt("Oracle", "0x65D66c76447ccB45dAf1e8044e918fA786A483A1")) as Oracle
    shortSqueeth = (await ethers.getContractAt("ShortPowerPerp", "0xa653e22A963ff0026292Cc8B67941c0ba7863a38")) as ShortPowerPerp
    wSqueethPool = await ethers.getContractAt(POOL_ABI, "0x82c427AdFDf2d245Ec51D8046b41c4ee87F0d29C")
    ethUsdcPool = await ethers.getContractAt(POOL_ABI, "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8");
    quoter = await ethers.getContractAt(QUOTER_ABI, "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6");

    const TickMathExternal = await ethers.getContractFactory("TickMathExternal")
    const TickMathExternalLib = (await TickMathExternal.deploy());

    const SqrtPriceMathPartial = await ethers.getContractFactory("SqrtPriceMathPartial")
    const SqrtPriceMathPartialLib = (await SqrtPriceMathPartial.deploy());

    const ControllerHelperUtil = await ethers.getContractFactory("ControllerHelperUtil", {libraries: {TickMathExternal: TickMathExternalLib.address, SqrtPriceMathPartial: SqrtPriceMathPartialLib.address}});
    const ControllerHelperUtilLib = (await ControllerHelperUtil.deploy());
    
    const ControllerHelperContract = await ethers.getContractFactory("ControllerHelper", {libraries: {ControllerHelperUtil: ControllerHelperUtilLib.address}});
    controllerHelper = (await ControllerHelperContract.deploy(controller.address, positionManager.address, uniswapFactory.address, "0x59828FdF7ee634AaaD3f58B19fDBa3b03E2D9d80", "0x27182842E098f60e3D576794A5bFFb0777E025d3", "0x62e28f054efc24b26A794F5C1249B6349454352C")) as ControllerHelper;
  })

  describe("Flash mint short position, LP and use LP as collateral", async () => {
    it("open short, mint, LP oSQTH + ETH, deposit LP NFT and withdraw ETH collateral", async ()=> {
      const vaultId = (await shortSqueeth.nextId());
      const normFactor = await controller.getExpectedNormalizationFactor()
      const mintWSqueethAmount = ethers.utils.parseUnits('50')
      const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralToMint = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
      const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 420, true)
      const collateralToLp = mintWSqueethAmount.mul(squeethPrice).div(one)
      const flashloanFee = collateralToMint.mul(9).div(1000)
      const flashloanWMintDepositNftParams = {
        wPowerPerpPool: wSqueethPool.address,
        vaultId: 0,
        wPowerPerpAmount: mintWSqueethAmount.toString(),
        collateralToDeposit: collateralToMint.toString(),
        collateralToFlashloan: collateralToMint.toString(),
        collateralToLp: collateralToLp.toString(),
        collateralToWithdraw: 0,
        amount0Min: 0,
        amount1Min: 0,
        lowerTick: -887220,
        upperTick: 887220
      }

      const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

      await controllerHelper.connect(depositor).flashloanWMintLpDepositNft(flashloanWMintDepositNftParams, {value: collateralToLp.add(ethers.utils.parseUnits('0.01').add(flashloanFee))})

      const depositorSqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
      const vaultAfter = await controller.vaults(vaultId)
      const tokenIndexAfter = await (positionManager as INonfungiblePositionManager).totalSupply();
      const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndexAfter.sub(1));
      const position = await (positionManager as INonfungiblePositionManager).positions(tokenId)

      expect(BigNumber.from(vaultAfter.NftCollateralId).eq(tokenId)).to.be.true;
      expect(position.tickLower === -887220).to.be.true
      expect(position.tickUpper === 887220).to.be.true
      expect(vaultAfter.shortAmount.sub(mintWSqueethAmount).lte(1)).to.be.true
      expect(depositorSqueethBalanceAfter.sub(depositorSqueethBalanceBefore).lte(10)).to.be.true
      expect(vaultAfter.collateralAmount.eq(BigNumber.from(0))).to.be.true
    })

    it("open short, mint, LP oSQTH + ETH, deposit LP NFT and withdraw ETH collateral with too much oSQTH specified", async ()=> {
      // this is testing that the vault is minted with ~ the correct amount of oSQTH even if way too much is specified on f/e, which is what we want
      const vaultId = (await shortSqueeth.nextId());
      const normFactor = await controller.getExpectedNormalizationFactor()
      const mintWSqueethAmount = ethers.utils.parseUnits('50')
      const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralToMint = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
      const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 420, true)
      const collateralToLp = mintWSqueethAmount.mul(squeethPrice).div(one)
      const flashloanFee = collateralToMint.mul(9).div(1000)
      const flashloanWMintDepositNftParams = {
        wPowerPerpPool: wSqueethPool.address,
        vaultId: 0,
        wPowerPerpAmount: mintWSqueethAmount.mul(2).toString(),
        collateralToDeposit: collateralToMint.mul(2).toString(),
        collateralToFlashloan: collateralToMint.mul(2).toString(),
        collateralToLp: collateralToLp.toString(),
        collateralToWithdraw: 0,
        amount0Min: 0,
        amount1Min: 0,
        lowerTick: -887220,
        upperTick: 887220
      }

      const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

      await controllerHelper.connect(depositor).flashloanWMintLpDepositNft(flashloanWMintDepositNftParams, {value: collateralToLp.add(ethers.utils.parseUnits('0.01').add(flashloanFee))})

      const depositorSqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
      const vaultAfter = await controller.vaults(vaultId)
      const tokenIndexAfter = await (positionManager as INonfungiblePositionManager).totalSupply();
      const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndexAfter.sub(1));
      const position = await (positionManager as INonfungiblePositionManager).positions(tokenId)

      expect(BigNumber.from(vaultAfter.NftCollateralId).eq(tokenId)).to.be.true;
      expect(position.tickLower === -887220).to.be.true
      expect(position.tickUpper === 887220).to.be.true
      expect(depositorSqueethBalanceAfter.sub(depositorSqueethBalanceBefore).lte(10)).to.be.true
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

        const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

        const mintWSqueethAmount = ethers.utils.parseUnits('5')
        const collateralToMint = BigNumber.from(0)
        const collateralToLp = BigNumber.from(0)

        const slot0 = await wSqueethPool.slot0()
        const currentTick = slot0[1]
  
        const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16) 
        const amount0Min = BigNumber.from(0);
        const amount1Min = BigNumber.from(0);
  
        const newTick = isWethToken0 ? 60*((currentTick - currentTick%60)/60 - 1): 60*((currentTick - currentTick%60)/60 + 1)

        const flashloanWMintDepositNftParams = {
          wPowerPerpPool: wSqueethPool.address,
          vaultId: vaultId,
          wPowerPerpAmount: mintWSqueethAmount.toString(),
          collateralToDeposit: collateralToMint.toString(),
          collateralToFlashloan: BigNumber.from(0),
          collateralToLp: collateralToLp.toString(),
          collateralToWithdraw: 0,
          amount0Min: 0,
          amount1Min: 0,
          lowerTick: isWethToken0 ? -887220 : newTick,
          upperTick: isWethToken0 ? newTick : 887220,
          }

        const vaultBefore = await controller.vaults(vaultId)

        await controllerHelper.connect(depositor).flashloanWMintLpDepositNft(flashloanWMintDepositNftParams)
        
        const vaultAfter = await controller.vaults(vaultId)
        const tokenIndexAfter = await (positionManager as INonfungiblePositionManager).totalSupply();
        const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndexAfter.sub(1));
        const position = await (positionManager as INonfungiblePositionManager).positions(tokenId)

        const depositorSqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
  
        expect(BigNumber.from(vaultAfter.NftCollateralId).eq(tokenId)).to.be.true;
        expect(vaultAfter.shortAmount.sub(mintWSqueethAmount.add(vaultBefore.shortAmount)).abs().lte(10)).to.be.true
        expect(depositorSqueethBalanceAfter.sub(depositorSqueethBalanceBefore).lte(10)).to.be.true
        expect(vaultAfter.collateralAmount.eq(vaultBefore.collateralAmount)).to.be.true
      })
    })

    it("open short in new vault, mint, LP oSQTH only, deposit LP NFT", async () => {
      const vaultId = (await shortSqueeth.nextId());
      const normFactor = await controller.getExpectedNormalizationFactor()
      const mintWSqueethAmount = ethers.utils.parseUnits('100')
      const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralToMint = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
      const collateralToFlashloan = collateralToMint.div(2)
      const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)

      const slot0 = await wSqueethPool.slot0()
      const currentTick = slot0[1]

      const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16) 
      const amount0Min = BigNumber.from(0);
      const amount1Min = BigNumber.from(0);

      const newTick = isWethToken0 ? 60*((currentTick - currentTick%60)/60 - 1): 60*((currentTick - currentTick%60)/60 + 1)
      
      const flashloanWMintDepositNftParams = {
        wPowerPerpPool: wSqueethPool.address,
        vaultId: 0,
        wPowerPerpAmount: mintWSqueethAmount.toString(),
        collateralToDeposit: collateralToMint.toString(),
        collateralToFlashloan: collateralToFlashloan.toString(),
        collateralToLp: BigNumber.from(0),
        collateralToWithdraw: 0,
        amount0Min: amount0Min,
        amount1Min: amount1Min,
        lowerTick: isWethToken0 ? -887220 : newTick,
        upperTick: isWethToken0 ? newTick : 887220,
    }

      await controllerHelper.connect(depositor).flashloanWMintLpDepositNft(flashloanWMintDepositNftParams, {value: collateralToMint.div(2).add(ethers.utils.parseUnits('0.01'))})

      const vaultAfter = await controller.vaults(vaultId)
      const tokenIndexAfter = await (positionManager as INonfungiblePositionManager).totalSupply();
      const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndexAfter.sub(1));
      const position = await (positionManager as INonfungiblePositionManager).positions(tokenId)
      const depositorSqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)

      expect(BigNumber.from(vaultAfter.NftCollateralId).eq(tokenId)).to.be.true;
      expect(vaultAfter.shortAmount.sub(mintWSqueethAmount).abs().lte(10)).to.be.true      
      expect(depositorSqueethBalanceAfter.sub(depositorSqueethBalanceBefore).lte(10)).to.be.true
      expect(vaultAfter.collateralAmount.eq(collateralToMint.sub(collateralToFlashloan))).to.be.true
    })

    it("open short, mint with >0 ETH collateral, LP oSQTH + ETH, deposit LP NFT", async ()=> {
      const vaultId = (await shortSqueeth.nextId());
      const normFactor = await controller.getExpectedNormalizationFactor()
      const mintWSqueethAmount = ethers.utils.parseUnits('50')
      const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralToMint = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
      const collateralToFlashloan = collateralToMint.div(2)
      const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 420, true)
      const collateralToLp = mintWSqueethAmount.mul(squeethPrice).div(one)
      const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)
      const flashloanWMintDepositNftParams = {
        wPowerPerpPool: wSqueethPool.address,
        vaultId: 0,
        wPowerPerpAmount: mintWSqueethAmount.toString(),
        collateralToDeposit: collateralToMint.toString(),
        collateralToFlashloan: collateralToFlashloan.toString(),
        collateralToLp: collateralToLp.toString(),
        collateralToWithdraw: 0,
        amount0Min: 0,
        amount1Min: 0,
        lowerTick: -887220,
        upperTick: 887220
      }

      await controllerHelper.connect(depositor).flashloanWMintLpDepositNft(flashloanWMintDepositNftParams, {value: collateralToLp.add(collateralToMint.div(2)).add(ethers.utils.parseUnits('0.01'))})

      const depositorSqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
      const vaultAfter = await controller.vaults(vaultId)
      const tokenIndexAfter = await (positionManager as INonfungiblePositionManager).totalSupply();
      const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndexAfter.sub(1));
      const position = await (positionManager as INonfungiblePositionManager).positions(tokenId)

      expect(BigNumber.from(vaultAfter.NftCollateralId).eq(tokenId)).to.be.true;
      expect(position.tickLower === -887220).to.be.true
      expect(position.tickUpper === 887220).to.be.true
      expect(vaultAfter.shortAmount.sub(mintWSqueethAmount).lte(1)).to.be.true
      expect(depositorSqueethBalanceAfter.sub(depositorSqueethBalanceBefore).lte(10)).to.be.true

      expect(vaultAfter.collateralAmount.sub(collateralToMint.div(2)).lte(1)).to.be.true
    })

    it("existing vault, mint with >0 ETH collateral, LP oSQTH + ETH, deposit LP NFT", async ()=> {
      // Make new vault with 2x collateral
      const normFactor = await controller.getExpectedNormalizationFactor()
      const mintWSqueethAmount : BigNumber = ethers.utils.parseUnits('50')
      const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralToDeposit = debtInEth.mul(2)
      await controller.connect(depositor).mintWPowerPerpAmount(0, mintWSqueethAmount, 0, {value: collateralToDeposit})
      const vaultId = (await shortSqueeth.nextId()).sub(1);
      await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address)
      // Get before context
      const vaultBefore = await controller.vaults(vaultId)
      const depositorEthBalanceBefore = await ethers.provider.getBalance(depositor.address)
      // Set up for full range LP with half collateral flashloaned
      const collateralToMint = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
      const collateralToFlashloan = collateralToMint.div(2)
      const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 420, true)
      const collateralToLp = mintWSqueethAmount.mul(squeethPrice).div(one)
      const flashloanWMintDepositNftParams = {
        wPowerPerpPool: wSqueethPool.address,
        vaultId: vaultId,
        wPowerPerpAmount: mintWSqueethAmount.toString(),
        collateralToDeposit: collateralToMint.toString(),
        collateralToFlashloan: collateralToFlashloan.toString(),
        collateralToLp: collateralToLp.toString(),
        collateralToWithdraw: 0,
        amount0Min: 0,
        amount1Min: 0,
        lowerTick: -887220,
        upperTick: 887220
      }
      // Look at transasction
      const tx = await controllerHelper.connect(depositor).flashloanWMintLpDepositNft(flashloanWMintDepositNftParams, {value: collateralToLp.add(collateralToMint)})
      const depositorEthBalanceAfter = await ethers.provider.getBalance(depositor.address)
      const receipt = await tx.wait()
      const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice)
      // Get after context
      const vaultAfter = await controller.vaults(vaultId)
      const tokenIndexAfter = await (positionManager as INonfungiblePositionManager).totalSupply();
      const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndexAfter.sub(1));
      const ownerOfUniNFT = await (positionManager as INonfungiblePositionManager).ownerOf(tokenId); 
      const position = await (positionManager as INonfungiblePositionManager).positions(tokenId)

      expect(BigNumber.from(vaultAfter.NftCollateralId).eq(tokenId)).to.be.true;
      expect(position.tickLower === -887220).to.be.true
      expect(position.tickUpper === 887220).to.be.true
      expect(ownerOfUniNFT === controller.address).to.be.true
      //expect(vaultAfter.shortAmount.sub(vaultBefore.shortAmount).sub(mintWSqueethAmount).abs().lte(1000)).to.be.true
      expect(vaultAfter.collateralAmount.sub(vaultBefore.collateralAmount).sub((collateralToMint.sub(collateralToFlashloan))).eq(0)).to.be.true
      expect(depositorEthBalanceAfter.sub(depositorEthBalanceBefore).sub(gasSpent).sub((collateralToMint.sub(collateralToFlashloan))).lte(1)).to.be.true
    })

    it("open short in new vault, mint, LP oSQTH only, deposit LP NFT, no eth added", async () => {
      // New vault with 2x collateral
      const normFactor = await controller.getExpectedNormalizationFactor()
      const mintWSqueethAmount : BigNumber = ethers.utils.parseUnits('40')
      const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralToDeposit = debtInEth.mul(2)
      await controller.connect(depositor).mintWPowerPerpAmount(0, mintWSqueethAmount, 0, {value: collateralToDeposit})
      const vaultId = (await shortSqueeth.nextId()).sub(1);
      await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address)
      // Get before context
      const vaultBefore = await controller.vaults(vaultId)
      const depositorEthBalanceBefore = await ethers.provider.getBalance(depositor.address)

      const slot0 = await wSqueethPool.slot0()
      const currentTick = slot0[1]

      const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16) 
      const amount0Min = BigNumber.from(0);
      const amount1Min = BigNumber.from(0);

      const newTick = isWethToken0 ? 60*((currentTick - currentTick%60)/60 - 10): 60*((currentTick - currentTick%60)/60 + 10)
      
      // Flashloan to cover complete removal of LP (rearrange collateral ratio formula for 1.5 and add 0.1 ETH safety margin)
      const flashLoanAmount = (vaultBefore.shortAmount.add(mintWSqueethAmount)).mul(normFactor).mul(ethPrice).mul(3).div(one.mul(one).mul(10000).mul(2)).sub(vaultBefore.collateralAmount).add(ethers.utils.parseUnits('0.1'))

      const flashloanWMintDepositNftParams = {
        wPowerPerpPool: wSqueethPool.address,
        vaultId: vaultId,
        wPowerPerpAmount: mintWSqueethAmount,
        collateralToDeposit: flashLoanAmount,
        collateralToFlashloan: flashLoanAmount,
        collateralToLp: 0,
        collateralToWithdraw: 0,
        amount0Min: amount0Min,
        amount1Min: amount1Min,
        lowerTick: isWethToken0 ? -887220 : newTick,
        upperTick: isWethToken0 ? newTick : 887220,
    }
      // Set up for one-sided LP with oSQTH only with half collateral flashloaned


      const tx = await controllerHelper.connect(depositor).flashloanWMintLpDepositNft(flashloanWMintDepositNftParams)
      const depositorEthBalanceAfter = await ethers.provider.getBalance(depositor.address)
      const receipt = await tx.wait()
      const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice)
      // Get after context
      const vaultAfter = await controller.vaults(vaultId)
      const tokenIndexAfter = await (positionManager as INonfungiblePositionManager).totalSupply();
      const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndexAfter.sub(1));
      const ownerOfUniNFT = await (positionManager as INonfungiblePositionManager).ownerOf(tokenId); 
      const position = await (positionManager as INonfungiblePositionManager).positions(tokenId)

      expect(BigNumber.from(vaultAfter.NftCollateralId).eq(tokenId)).to.be.true;
      expect(position.tickLower === (isWethToken0 ? -887220 : newTick)).to.be.true
      expect(position.tickUpper === (isWethToken0 ? newTick : 887220)).to.be.true
      expect(ownerOfUniNFT === controller.address).to.be.true
      expect(vaultAfter.shortAmount.sub(vaultBefore.shortAmount).sub(mintWSqueethAmount).abs().lte(10)).to.be.true
      expect(vaultAfter.collateralAmount.sub(vaultBefore.collateralAmount).eq(0)).to.be.true
      expect(depositorEthBalanceAfter.sub(depositorEthBalanceBefore).sub(gasSpent).lte(1)).to.be.true
    })
    

    it("open short in new vault, mint, LP oSQTH only, deposit LP NFT, some eth added", async () => {
      // New vault with 1.5x collateral
      const normFactor = await controller.getExpectedNormalizationFactor()
      const mintWSqueethAmount : BigNumber = ethers.utils.parseUnits('100')
      const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralToDeposit = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
      await controller.connect(depositor).mintWPowerPerpAmount(0, mintWSqueethAmount, 0, {value: collateralToDeposit})
      const vaultId = (await shortSqueeth.nextId()).sub(1);
      await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address)
      // Get before context
      const vaultBefore = await controller.vaults(vaultId)
      const depositorEthBalanceBefore = await ethers.provider.getBalance(depositor.address)
      // Mint full range into vault with no added eth
      const flashloanWMintDepositNftParams = {
        wPowerPerpPool: wSqueethPool.address,
        vaultId: vaultId.toString(),
        wPowerPerpAmount: mintWSqueethAmount.toString(),
        collateralToDeposit: collateralToDeposit.add(debtInEth).toString(),
        collateralToFlashloan: debtInEth.toString(),
        collateralToLp: BigNumber.from(0),
        collateralToWithdraw: 0,
        amount0Min: 0,
        amount1Min: 0,
        lowerTick: -887220,
        upperTick: 0
      }
      const tx = await controllerHelper.connect(depositor).flashloanWMintLpDepositNft(flashloanWMintDepositNftParams, {value: collateralToDeposit})
      const depositorEthBalanceAfter = await ethers.provider.getBalance(depositor.address)
      const receipt = await tx.wait()
      const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice)
      // Get after context
      const vaultAfter = await controller.vaults(vaultId)
      const tokenIndexAfter = await (positionManager as INonfungiblePositionManager).totalSupply();
      const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndexAfter.sub(1));
      const ownerOfUniNFT = await (positionManager as INonfungiblePositionManager).ownerOf(tokenId); 
      const position = await (positionManager as INonfungiblePositionManager).positions(tokenId)
      expect(BigNumber.from(vaultAfter.NftCollateralId).eq(tokenId)).to.be.true;
      expect(position.tickLower === -887220).to.be.true
      expect(position.tickUpper === 0).to.be.true
      expect(ownerOfUniNFT === controller.address).to.be.true
      expect(vaultAfter.shortAmount.sub(mintWSqueethAmount.mul(2)).abs().lte(10)).to.be.true
      expect(vaultAfter.collateralAmount.eq(collateralToDeposit.mul(2))).to.be.true
      expect(vaultAfter.collateralAmount.sub(vaultBefore.collateralAmount).sub(collateralToDeposit).eq(0)).to.be.true
      expect(depositorEthBalanceAfter.sub(depositorEthBalanceBefore).add(gasSpent).add(collateralToDeposit).abs().lte(1)).to.be.true
 
    })    
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
        amount1Min: 0,
        poolFee: 3000,
        burnExactRemoved: false
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
      const mintWSqueethAmount = ethers.utils.parseUnits('55')
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
        amount1Min: 0,
        poolFee: 3000,
        burnExactRemoved: false
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

  describe("Collect fees from vault and redeposit", async () => {
    before("open short position and LP" , async () => {
      const vaultId = (await shortSqueeth.nextId());
      const normFactor = await controller.getExpectedNormalizationFactor()
      const mintWSqueethAmount = ethers.utils.parseUnits('50')
      const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralToMint = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
      const collateralToFlashloan = collateralToMint
      const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 1, true)
      const collateralToLp = mintWSqueethAmount.mul(squeethPrice).div(one)
      const flashloanWMintDepositNftParams = {
        wPowerPerpPool: wSqueethPool.address,
        vaultId: 0,
        wPowerPerpAmount: mintWSqueethAmount.toString(),
        collateralToDeposit: collateralToFlashloan.toString(),
        collateralToFlashloan: collateralToFlashloan.toString(),
        collateralToLp: collateralToLp.toString(),
        collateralToWithdraw: 0,
        amount0Min: 0,
        amount1Min: 0,
        lowerTick: -887220,
        upperTick: 887220
      }

      await controllerHelper.connect(depositor).flashloanWMintLpDepositNft(flashloanWMintDepositNftParams, {value: collateralToLp})
    })

    it("swap with pool, collect fees and redeposit uni nft in vault", async () => {
      
      const ethToSell = ethers.utils.parseUnits("5")
      const swapParamBuy = {
        tokenIn: weth.address,
        tokenOut: wSqueeth.address,
        fee: 3000,
        recipient: owner.address,
        deadline: Math.floor(await getNow(ethers.provider) + 8640000),
        amountIn: ethToSell.toString(),
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
      }    

      weth.connect(owner).deposit({value: ethToSell})
 
      const ownerSqueethBalanceBeforeTrade1 = await wSqueeth.balanceOf(owner.address)
      const ownerWethBalanceBeforeTrade1 = await weth.balanceOf(owner.address)

      await weth.connect(owner).approve(uniswapRouter.address, constants.MaxUint256)

      await uniswapRouter.connect(owner).exactInputSingle(swapParamBuy)

      const ownerSqueethBalanceAfterTrade1 = await wSqueeth.balanceOf(owner.address)
      const ownerWethBalanceAfterTrade1 = await weth.balanceOf(owner.address)

      expect(ownerWethBalanceBeforeTrade1.sub(ownerWethBalanceAfterTrade1).eq(ethToSell)).to.be.true
      // 
      const wSqueethToSell = ownerSqueethBalanceAfterTrade1.sub(ownerSqueethBalanceBeforeTrade1).sub(ethers.utils.parseUnits('0.01'))
      const swapParamSell = {
        tokenIn: wSqueeth.address,
        tokenOut: weth.address,
        fee: 3000,
        recipient: owner.address,
        deadline: Math.floor(await getNow(ethers.provider) + 8640000),
        amountIn: wSqueethToSell.toString(),
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
      }    

      const ownerSqueethBalanceBeforeTrade2 = await wSqueeth.balanceOf(owner.address)
      await wSqueeth.connect(owner).approve(uniswapRouter.address, constants.MaxUint256)
      await uniswapRouter.connect(owner).exactInputSingle(swapParamSell)
      const ownerSqueethBalanceAfterTrade2 = await wSqueeth.balanceOf(owner.address)
      expect(ownerSqueethBalanceBeforeTrade2.sub(ownerSqueethBalanceAfterTrade2).eq(wSqueethToSell)).to.be.true

      const vaultId = (await shortSqueeth.nextId()).sub(1);
      const uniTokenId =  (await controller.vaults(vaultId)).NftCollateralId;
      const vaultBefore = await controller.vaults(vaultId); 
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = vaultBefore.shortAmount.mul(scaledEthPrice).div(one)
      const collateralToFlashloan = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
      const positionBefore = await (positionManager as INonfungiblePositionManager).positions(uniTokenId);

      const amount0Max = BigNumber.from(2).mul(BigNumber.from(10).pow(18)).sub(1)
      const amount1Max = BigNumber.from(2).mul(BigNumber.from(10).pow(18)).sub(1)

      const abiCoder = new ethers.utils.AbiCoder
      const rebalanceLpInVaultParams = [
      {
          rebalanceLpInVaultType: BigNumber.from(6),
          // CollectFees
          data: abiCoder.encode(["uint256", "uint128", "uint128"], [uniTokenId, amount0Max, amount1Max])
        },
        {
          rebalanceLpInVaultType: BigNumber.from(7),
          // DepositExistingNftParams
          data: abiCoder.encode(["uint256"], [uniTokenId])
        }
      ]

      await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address);

      const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)
      const depositorEthBalanceBefore = await ethers.provider.getBalance(depositor.address)
      const tx = await controllerHelper.connect(depositor).rebalanceLpInVault(vaultId, collateralToFlashloan, rebalanceLpInVaultParams);

      const receipt = await tx.wait()
      const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice)
      const depositorSqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
      const depositorEthBalanceAfter = await ethers.provider.getBalance(depositor.address)

      const positionAfter = await (positionManager as INonfungiblePositionManager).positions(uniTokenId);
      const vaultAfter = await controller.vaults(vaultId); 

      expect(positionAfter.tickLower === -887220).to.be.true
      expect(positionAfter.tickUpper === 887220).to.be.true
      expect(positionAfter.liquidity.eq(positionBefore.liquidity)).to.be.true
      expect(vaultAfter.NftCollateralId==vaultBefore.NftCollateralId).to.be.true
      expect(depositorSqueethBalanceAfter.gt(depositorSqueethBalanceBefore)).to.be.true
      expect(depositorEthBalanceAfter.add(gasSpent).gt(depositorEthBalanceBefore)).to.be.true 

    })
  })

  describe("Rebalance with vault", async () => {
      before("Mint new full range LP outside of vault" , async () => {
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
        const batchMintLpParams = {
          recipient: depositor.address,
          wPowerPerpPool: wSqueethPool.address,
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
        await controllerHelper.connect(depositor).wMintLp(batchMintLpParams, {value: collateralAmount.add(collateralToLp)});
       })

        
    it("Close vault LP and open new LP with the a different range, same amount of ETH and oSQTH", async () => {
      // Get vault and LP info
      const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)
      const depositorEthBalanceBefore = await ethers.provider.getBalance(depositor.address)
      const vaultId = (await shortSqueeth.nextId()).sub(1);
      const tokenIndex = await (positionManager as INonfungiblePositionManager).totalSupply();
      const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndex.sub(1));
      const positionBefore = await (positionManager as INonfungiblePositionManager).positions(tokenId)
      const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16)
      // Get current LPpositions
      const [amount0, amount1] = await (positionManager as INonfungiblePositionManager).connect(depositor).callStatic.decreaseLiquidity({
        tokenId: tokenId,
        liquidity: positionBefore.liquidity,
        amount0Min: 0,
        amount1Min: 0,
        deadline: Math.floor(await getNow(ethers.provider) + 8640000),
      })
      const wPowerPerpAmountInLPBefore = (isWethToken0) ? amount1 : amount0;
      const wethAmountInLPBefore = (isWethToken0) ? amount0 : amount1;
      // deposit nft to vault (approve first)
      await shortSqueeth.connect(depositor).approve(controller.address, vaultId);
      await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address)
      await (positionManager as INonfungiblePositionManager).connect(depositor).setApprovalForAll(controller.address, true) // approval for controller 
      await (positionManager as INonfungiblePositionManager).connect(depositor).setApprovalForAll(controllerHelper.address, true) // approve controllerHelper
      // Deposit nft to vault
      await controller.connect(depositor).depositUniPositionToken(vaultId, tokenId)
      // Withdraw some ETH from vault (so not purely collateralized with ETH)
      const withdrawFromVault = wethAmountInLPBefore
      await controller.connect(depositor).withdraw(vaultId, withdrawFromVault)
      const vaultBefore = await controller.vaults(vaultId);
      // Setup for mint of new LP
      const slot0 = await wSqueethPool.slot0()
      const currentTick = slot0[1]
      // Closest 600 tick width around current tick (60 is minimum tick width for 30bps pool)
      const newTickLower = 60*((currentTick - currentTick%60)/60 - 10)
      const newTickUpper = 60*((currentTick - currentTick%60)/60 + 10)
      //const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16) 
      const amount0Min = BigNumber.from(0);
      const amount1Min = BigNumber.from(0);
      // random additional proceeds from swap
      const surpriseProceeds = ethers.utils.parseUnits('0.01')
      // Setup rebalanceVaultNft call
      const abiCoder = new ethers.utils.AbiCoder
      const rebalanceLpInVaultParams = [
        {
          // Remove liquidity
          rebalanceLpInVaultType: BigNumber.from(1), // DecreaseLpLiquidity:
          // DecreaseLpLiquidityParams: [tokenId, liquidity, liquidityPercentage, amount0Min, amount1Min]
          data: abiCoder.encode(["uint256", 'uint256', 'uint256', 'uint128', 'uint128'],
           [tokenId, positionBefore.liquidity, BigNumber.from(100).mul(BigNumber.from(10).pow(16)), BigNumber.from(0), BigNumber.from(0)])
          },
         {
           // Mint new LP (add 0.01 oSQTH noise since exact value will not be known)
           rebalanceLpInVaultType: BigNumber.from(4), // MintNewLP
           // MintAndLpParams: [recipient, wPowerPerpPool, vaultId, wPowerPerpAmount, collateralToDeposit, collateralToLP, amount0Min, amount1Min, lowerTick, upperTick ]
           data: abiCoder.encode(["address", "address", "uint256", 'uint256','uint256', 'uint256', 'uint256', 'uint256', 'int24', 'int24'],
            [controllerHelper.address, wSqueethPool.address, vaultId, wPowerPerpAmountInLPBefore.add(surpriseProceeds), BigNumber.from(0), wethAmountInLPBefore, amount0Min, amount1Min, newTickLower, newTickUpper])
         }
      ]
      // Flashloan to cover complete removal of LP (rearrange collateral ratio formula for 1.5 and add 0.1 ETH safety margin)
      const normFactor = await controller.getExpectedNormalizationFactor()
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 1, true)
      const flashLoanAmount = (vaultBefore.shortAmount).mul(normFactor).mul(ethPrice).mul(3).div(one.mul(one).mul(10000).mul(2)).sub(vaultBefore.collateralAmount).add(ethers.utils.parseUnits('0.1'))
      const tx = await controllerHelper.connect(depositor).rebalanceLpInVault(vaultId, flashLoanAmount, rebalanceLpInVaultParams);
      const receipt = await tx.wait()
      const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice)
      const depositorSqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
      const depositorEthBalanceAfter = await ethers.provider.getBalance(depositor.address)
      // Get new vault and LP info
      const vaultAfter = await controller.vaults(vaultId);
      const tokenIdAfter = vaultAfter.NftCollateralId;
      const positionAfter = await (positionManager as INonfungiblePositionManager).positions(tokenIdAfter)
      const [amount0After, amount1After] = await (positionManager as INonfungiblePositionManager).connect(controllerSigner).callStatic.decreaseLiquidity({
        tokenId: tokenIdAfter,
        liquidity: positionAfter.liquidity,
        amount0Min: 0,
        amount1Min: 0,
        deadline: Math.floor(await getNow(ethers.provider) + 8640000),
      })
      const wPowerPerpAmountInLPAfter = (isWethToken0) ? amount1After : amount0After;
      const wethAmountInLPAfter = (isWethToken0) ? amount0After : amount1After;
      // Changes
      const depositorEthDiff = depositorEthBalanceAfter.sub(depositorEthBalanceBefore)
      const depositorSqueethDiff = depositorSqueethBalanceAfter.sub(depositorSqueethBalanceBefore)
      const vaultEthDiff = vaultAfter.collateralAmount.sub(vaultBefore.collateralAmount)
      const vaultSqueethDiff = vaultAfter.shortAmount.sub(vaultBefore.shortAmount)
      const lpEthDiff = wethAmountInLPAfter.sub(wethAmountInLPBefore)
      const lpSqueethDiff = wPowerPerpAmountInLPAfter.sub(wPowerPerpAmountInLPBefore)
      // Assertions
      expect(positionAfter.tickLower === newTickLower).to.be.true
      expect(positionAfter.tickUpper === newTickUpper).to.be.true
      expect(vaultAfter.collateralAmount.eq(vaultBefore.collateralAmount)).to.be.true
      expect(vaultAfter.NftCollateralId==vaultBefore.NftCollateralId).to.be.false
      // Squeeth preserving
      expect(depositorSqueethDiff.sub(vaultSqueethDiff).add(lpSqueethDiff).abs().lte(10)).to.be.true
    })
  })

  describe("Rebalance LP in vault to just weth", async () => {
    before("Mint new full range LP outside of vault" , async () => {
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
      const wMintLpParams = {
        recipient: depositor.address,
        wPowerPerpPool: wSqueethPool.address,
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
      await controllerHelper.connect(depositor).wMintLp(wMintLpParams, {value: collateralAmount.add(collateralToLp)});
     })

      
  it("Close vault LP and open new one-sided LP with just eth ", async () => {
    // Get vault and LP info
    const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)
    const depositorEthBalanceBefore = await ethers.provider.getBalance(depositor.address)
    const vaultId = (await shortSqueeth.nextId()).sub(1);
    const tokenIndex = await (positionManager as INonfungiblePositionManager).totalSupply();
    const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndex.sub(1));
    const positionBefore = await (positionManager as INonfungiblePositionManager).positions(tokenId)
    const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16)
    // Get current LPpositions 
    const [amount0, amount1] = await (positionManager as INonfungiblePositionManager).connect(depositor).callStatic.decreaseLiquidity({
      tokenId: tokenId,
      liquidity: positionBefore.liquidity,
      amount0Min: 0,
      amount1Min: 0,
      deadline: Math.floor(await getNow(ethers.provider) + 8640000),
    })
    const wPowerPerpAmountInLPBefore = (isWethToken0) ? amount1 : amount0;
    const wethAmountInLPBefore = (isWethToken0) ? amount0 : amount1;
    // deposit nft to vault (approve first)
    await shortSqueeth.connect(depositor).approve(controller.address, vaultId);
    await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address)
    await (positionManager as INonfungiblePositionManager).connect(depositor).setApprovalForAll(controller.address, true) // approval for controller 
    await (positionManager as INonfungiblePositionManager).connect(depositor).setApprovalForAll(controllerHelper.address, true) // approve controllerHelper
    // Deposit nft to vault
    await controller.connect(depositor).depositUniPositionToken(vaultId, tokenId)
    const vaultBefore = await controller.vaults(vaultId);
    // Setup for mint of new LP
    const slot0 = await wSqueethPool.slot0()
    const currentTick = slot0[1]
    // Range above current tick
    const newTickLower = isWethToken0 ? 60*((currentTick - currentTick%60)/60 + 10): 60*((currentTick - currentTick%60)/60 - 20)
    const newTickUpper = isWethToken0 ? 60*((currentTick - currentTick%60)/60 + 20): 60*((currentTick - currentTick%60)/60 - 10)
    //const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16) 
    const amount0Min = BigNumber.from(0);
    const amount1Min = BigNumber.from(0);
    // Estimate proceeds from liquidating squeeth in LP
    const ethAmountOutFromSwap = await quoter.connect(depositor).callStatic.quoteExactInputSingle(wSqueeth.address,
      weth.address,
      3000,
      wPowerPerpAmountInLPBefore,
      0)
    // Estimate of new LP with 0.01 weth safety margin
    const safetyEth = ethers.utils.parseUnits('0.01')
    const safetyWPowerPerp = ethers.utils.parseUnits('0.01')
    const wethAmountToLP = wethAmountInLPBefore.add(ethAmountOutFromSwap).sub(safetyEth)
    // Setup rebalanceVaultNft call
    const abiCoder = new ethers.utils.AbiCoder
    const rebalanceLpInVaultParams = [
      {
        // Liquidate LP
        rebalanceLpInVaultType: BigNumber.from(1), // DecreaseLpLiquidity:
        // DecreaseLpLiquidityParams: [tokenId, liquidity, liquidityPercentage, amount0Min, amount1Min]
        data: abiCoder.encode(["uint256", 'uint256', 'uint256', 'uint128', 'uint128'],
         [tokenId, positionBefore.liquidity, BigNumber.from(100).mul(BigNumber.from(10).pow(16)), BigNumber.from(0), BigNumber.from(0)])
        },
        {
        // Sell all oSQTH for ETH
        rebalanceLpInVaultType: BigNumber.from(5), // GeneralSwap:
          // GeneralSwap: [tokenIn, tokenOut, amountIn, limitPrice]
          data: abiCoder.encode(["address", 'address', 'uint256', 'uint256', 'uint24'],
           [wSqueeth.address, weth.address, wPowerPerpAmountInLPBefore.sub(safetyWPowerPerp), BigNumber.from(0), 3000])
          },
       {
         // Mint new LP 
         rebalanceLpInVaultType:  BigNumber.from(4), // MintNewLP
         // lpWPowerPerpPool: [recipient, wPowerPerpPool, vaultId, wPowerPerpAmount, collateralToDeposit, collateralToLP, amount0Min, amount1Min, lowerTick, upperTick ]
         data: abiCoder.encode(["address", "address", "uint256", 'uint256','uint256', 'uint256', 'uint256', 'uint256', 'int24', 'int24'],
          [controllerHelper.address, wSqueethPool.address, vaultId, BigNumber.from(0), BigNumber.from(0), wethAmountToLP, amount0Min, amount1Min, newTickLower, newTickUpper])
       }
    ]
    // Flashloan to cover complete removal of LP (rearrange collateral ratio formula for 1.5 and add 0.01 ETH safety margin)
    const normFactor = await controller.getExpectedNormalizationFactor()
    const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
    // flashloan amount to cover withdrawn LP
    const flashLoanAmount = (vaultBefore.shortAmount).mul(normFactor).mul(ethPrice).mul(3).div(one.mul(one).mul(10000).mul(2)).sub(vaultBefore.collateralAmount).add(ethers.utils.parseUnits('0.1'))

    // Rebalance vault
    const tx = await controllerHelper.connect(depositor).rebalanceLpInVault(vaultId, flashLoanAmount, rebalanceLpInVaultParams)
    const receipt = await tx.wait()
    const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice)
    const depositorSqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
    const depositorEthBalanceAfter = await ethers.provider.getBalance(depositor.address)
    // Get new vault and LP info
    const vaultAfter = await controller.vaults(vaultId);
    const tokenIdAfter = vaultAfter.NftCollateralId;
    const positionAfter = await (positionManager as INonfungiblePositionManager).positions(tokenIdAfter)
    const [amount0After, amount1After] = await (positionManager as INonfungiblePositionManager).connect(controllerSigner).callStatic.decreaseLiquidity({
      tokenId: tokenIdAfter,
      liquidity: positionAfter.liquidity,
      amount0Min: 0,
      amount1Min: 0,
      deadline: Math.floor(await getNow(ethers.provider) + 8640000),
    })
    const wPowerPerpAmountInLPAfter = (isWethToken0) ? amount1After : amount0After;
    const wethAmountInLPAfter = (isWethToken0) ? amount0After : amount1After;
    // Changes
    const depositorEthDiff = depositorEthBalanceAfter.sub(depositorEthBalanceBefore)
    const depositorSqueethDiff = depositorSqueethBalanceAfter.sub(depositorSqueethBalanceBefore)
    const vaultEthDiff = vaultAfter.collateralAmount.sub(vaultBefore.collateralAmount)
    const vaultSqueethDiff = vaultAfter.shortAmount.sub(vaultBefore.shortAmount)
    const lpEthDiff = wethAmountInLPAfter.sub(wethAmountInLPBefore)
    const lpSqueethDiff = wPowerPerpAmountInLPAfter.sub(wPowerPerpAmountInLPBefore)
    // Assertions
    expect(flashLoanAmount.gt(0)).to.be.true
    expect(positionAfter.tickLower === newTickLower).to.be.true
    expect(positionAfter.tickUpper === newTickUpper).to.be.true
    expect(vaultAfter.shortAmount.eq(vaultBefore.shortAmount)).to.be.true
    expect(vaultAfter.collateralAmount.eq(vaultBefore.collateralAmount)).to.be.true
    expect(vaultAfter.NftCollateralId==vaultBefore.NftCollateralId).to.be.false
    expect(wPowerPerpAmountInLPAfter.eq(BigNumber.from(0))).to.be.true
    expect(lpEthDiff.sub(ethAmountOutFromSwap).add(safetyEth).abs().lte(10)).to.be.true
  })

})



describe("Rebalance LP in vault to just weth", async () => {
  before("Mint new full range LP outside of vault" , async () => {
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
    const wMintLpParams = {
      recipient: depositor.address,
      wPowerPerpPool: wSqueethPool.address,
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
    await controllerHelper.connect(depositor).wMintLp(wMintLpParams, {value: collateralAmount.add(collateralToLp)});
   })


it("Mint more oSQTH, withdraw half eth from LP, deposit some eth into vault and withdraw some eth ", async () => {
  // Get vault and LP info
  const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)
  const depositorEthBalanceBefore = await ethers.provider.getBalance(depositor.address)
  const vaultId = (await shortSqueeth.nextId()).sub(1);
  const tokenIndex = await (positionManager as INonfungiblePositionManager).totalSupply();
  const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndex.sub(1));
  const positionBefore = await (positionManager as INonfungiblePositionManager).positions(tokenId)
  const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16)
  // Get current LPpositions 
  const tokenOwner = await (positionManager as INonfungiblePositionManager).connect(depositor).ownerOf(tokenId)

  const [amount0, amount1] = await (positionManager as INonfungiblePositionManager).connect(depositor).callStatic.decreaseLiquidity({
    tokenId: tokenId,
    liquidity: positionBefore.liquidity,
    amount0Min: 0,
    amount1Min: 0,
    deadline: Math.floor(await getNow(ethers.provider) + 8640000),
  })
  const wPowerPerpAmountInLPBefore = (isWethToken0) ? amount1 : amount0;
  const wethAmountInLPBefore = (isWethToken0) ? amount0 : amount1;
  // deposit nft to vault (approve first)
  await shortSqueeth.connect(depositor).approve(controller.address, vaultId);
  await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address)
  await (positionManager as INonfungiblePositionManager).connect(depositor).setApprovalForAll(controller.address, true) // approval for controller 
  await (positionManager as INonfungiblePositionManager).connect(depositor).setApprovalForAll(controllerHelper.address, true) // approve controllerHelper
  // Deposit nft to vault
  await controller.connect(depositor).depositUniPositionToken(vaultId, tokenId)
  const vaultBefore = await controller.vaults(vaultId);
  // Estimate proceeds from liquidating squeeth in LP

  // Estimate of new LP with 0.05 weth safety margin
  const safetyEth = ethers.utils.parseUnits('0.05')
  const wethAmountToDeposit =  wethAmountInLPBefore.div(4).sub(safetyEth)
  const wethAmountToWithdraw =  wethAmountInLPBefore.div(4).sub(safetyEth)
  const wPowerPerpAmountToMint = ethers.utils.parseUnits('1')
  // Setup rebalanceVaultNft call
  const abiCoder = new ethers.utils.AbiCoder
  const rebalanceLpInVaultParams = [

      {
        // Liquidate half of LP 
        rebalanceLpInVaultType: BigNumber.from(1), // DecreaseLpLiquidity:
        // DecreaseLpLiquidityParams: [tokenId, liquidity, liquidityPercentage, amount0Min, amount1Min]
        data: abiCoder.encode(["uint256", 'uint256', 'uint256', 'uint128', 'uint128'],
          [tokenId, positionBefore.liquidity, BigNumber.from(50).mul(BigNumber.from(10).pow(16)), BigNumber.from(0), BigNumber.from(0)])
      },
      {
        // Deposit into vault and mint 
        rebalanceLpInVaultType: BigNumber.from(2), // DepositIntoVault
        // DepsositIntoVault: [wPowerPerpToMint, collateralToDeposit]
        data: abiCoder.encode(["uint256", 'uint256'],
          [wPowerPerpAmountToMint, wethAmountToDeposit])
      }
  ]
  // Flashloan to cover complete removal of LP (rearrange collateral ratio formula for 1.5 and add 0.01 ETH safety margin)
  const normFactor = await controller.getExpectedNormalizationFactor()
  const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
  const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 1, true)
  const flashLoanAmount = (vaultBefore.shortAmount.add(wPowerPerpAmountToMint)).mul(normFactor).mul(ethPrice).mul(3).div(one.mul(one).mul(10000).mul(2)).sub(vaultBefore.collateralAmount).add(ethers.utils.parseUnits('0.1'))
  // Rebalance vault
  const tx = await controllerHelper.connect(depositor).rebalanceLpInVault(vaultId, flashLoanAmount, rebalanceLpInVaultParams)
  const receipt = await tx.wait()
  const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice)
  const depositorSqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
  const depositorEthBalanceAfter = await ethers.provider.getBalance(depositor.address)
  // Get new vault and LP info
  const vaultAfter = await controller.vaults(vaultId);
  const tokenIdAfter = vaultAfter.NftCollateralId;
  const positionAfter = await (positionManager as INonfungiblePositionManager).positions(tokenIdAfter)
  const [amount0After, amount1After] = await (positionManager as INonfungiblePositionManager).connect(controllerSigner).callStatic.decreaseLiquidity({
    tokenId: tokenIdAfter,
    liquidity: positionAfter.liquidity,
    amount0Min: 0,
    amount1Min: 0,
    deadline: Math.floor(await getNow(ethers.provider) + 8640000),
  })
  const wPowerPerpAmountInLPAfter = (isWethToken0) ? amount1After : amount0After;
  const wethAmountInLPAfter = (isWethToken0) ? amount0After : amount1After;
  // Changes
  const depositorEthDiff = depositorEthBalanceAfter.sub(depositorEthBalanceBefore)
  const depositorSqueethDiff = depositorSqueethBalanceAfter.sub(depositorSqueethBalanceBefore)
  const vaultEthDiff = vaultAfter.collateralAmount.sub(vaultBefore.collateralAmount)
  const vaultSqueethDiff = vaultAfter.shortAmount.sub(vaultBefore.shortAmount)
  const lpEthDiff = wethAmountInLPAfter.sub(wethAmountInLPBefore)
  const lpSqueethDiff = wPowerPerpAmountInLPAfter.sub(wPowerPerpAmountInLPBefore)


  // Assertions
  expect(vaultSqueethDiff.eq(wPowerPerpAmountToMint)).to.be.true
  expect(vaultEthDiff.eq(wethAmountToDeposit)).to.be.true
  expect(lpSqueethDiff.add(wPowerPerpAmountInLPBefore.div(2)).lte(10)).to.be.true
  expect(lpEthDiff.add(wethAmountInLPBefore.div(2)).lte(10)).to.be.true
  expect(depositorSqueethDiff.sub(wPowerPerpAmountInLPBefore.div(2)).sub(wPowerPerpAmountToMint).lte(10)).to.be.true 
})

})



describe("Rebalance LP in vault to just weth", async () => {
  before("Mint new full range LP outside of vault" , async () => {
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
    const batchMintLpParams = {
      recipient: depositor.address,
      wPowerPerpPool: wSqueethPool.address,
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
    await controllerHelper.connect(depositor).wMintLp(batchMintLpParams, {value: collateralAmount.add(collateralToLp)});
   })


it("Mint more oSQTH, withdraw half eth from LP, deposit some eth into vault and withdraw some eth ", async () => {
  // Get vault and LP info
  const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)
  const depositorEthBalanceBefore = await ethers.provider.getBalance(depositor.address)
  const vaultId = (await shortSqueeth.nextId()).sub(1);
  const tokenIndex = await (positionManager as INonfungiblePositionManager).totalSupply();
  const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndex.sub(1));
  const positionBefore = await (positionManager as INonfungiblePositionManager).positions(tokenId)
  const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16)
  // Get current LPpositions 
  const tokenOwner = await (positionManager as INonfungiblePositionManager).connect(depositor).ownerOf(tokenId)

  const [amount0, amount1] = await (positionManager as INonfungiblePositionManager).connect(depositor).callStatic.decreaseLiquidity({
    tokenId: tokenId,
    liquidity: positionBefore.liquidity,
    amount0Min: 0,
    amount1Min: 0,
    deadline: Math.floor(await getNow(ethers.provider) + 8640000),
  })
  const wPowerPerpAmountInLPBefore = (isWethToken0) ? amount1 : amount0;
  const wethAmountInLPBefore = (isWethToken0) ? amount0 : amount1;
  // deposit nft to vault (approve first)
  await shortSqueeth.connect(depositor).approve(controller.address, vaultId);
  await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address)
  await (positionManager as INonfungiblePositionManager).connect(depositor).setApprovalForAll(controller.address, true) // approval for controller 
  await (positionManager as INonfungiblePositionManager).connect(depositor).setApprovalForAll(controllerHelper.address, true) // approve controllerHelper
  // Deposit nft to vault
  await controller.connect(depositor).depositUniPositionToken(vaultId, tokenId)
  const vaultBefore = await controller.vaults(vaultId);
  // Estimate of new LP with 0.01 weth safety margin
  const safetyEth = ethers.utils.parseUnits('0.01')
  const wethAmountToDeposit =  wethAmountInLPBefore.div(4).sub(safetyEth)
  const wethAmountToWithdraw =  wethAmountInLPBefore.div(4).sub(safetyEth)
  const wPowerPerpAmountToMint = ethers.utils.parseUnits('1')
  // Setup rebalanceVaultNft call
  const abiCoder = new ethers.utils.AbiCoder
  const rebalanceLpInVaultParams = [

      {
        // Liquidate half of LP 
        rebalanceLpInVaultType: BigNumber.from(1), // DecreaseLpLiquidity:
        // DecreaseLpLiquidityParams: [tokenId, liquidity, liquidityPercentage, amount0Min, amount1Min]
        data: abiCoder.encode(["uint256", 'uint256', 'uint256', 'uint128', 'uint128'],
          [tokenId, positionBefore.liquidity, BigNumber.from(50).mul(BigNumber.from(10).pow(16)), BigNumber.from(0), BigNumber.from(0)])
      },
      {
        // Deposit into vault and mint 
        rebalanceLpInVaultType: BigNumber.from(2), // DepositIntoVault
        // DepsositIntoVault: [wPowerPerpToMint, collateralToDeposit]
        data: abiCoder.encode(["uint256", 'uint256'],
          [wPowerPerpAmountToMint, wethAmountToDeposit])
      }
  ]
  // Flashloan to cover complete removal of LP (rearrange collateral ratio formula for 1.5 and add 0.01 ETH safety margin)
  const normFactor = await controller.getExpectedNormalizationFactor()
  const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
  const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 1, true)
  const flashLoanAmount = (vaultBefore.shortAmount).mul(normFactor).mul(ethPrice).mul(3).div(one.mul(one).mul(10000).mul(2)).sub(vaultBefore.collateralAmount).add(ethers.utils.parseUnits('0.1'))

  // Rebalance vault
  const tx = await controllerHelper.connect(depositor).rebalanceLpInVault(vaultId, flashLoanAmount, rebalanceLpInVaultParams)
  const receipt = await tx.wait()
  const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice)
  const depositorSqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
  const depositorEthBalanceAfter = await ethers.provider.getBalance(depositor.address)
  // Get new vault and LP info
  const vaultAfter = await controller.vaults(vaultId);
  const tokenIdAfter = vaultAfter.NftCollateralId;
  const positionAfter = await (positionManager as INonfungiblePositionManager).positions(tokenIdAfter)
  const [amount0After, amount1After] = await (positionManager as INonfungiblePositionManager).connect(controllerSigner).callStatic.decreaseLiquidity({
    tokenId: tokenIdAfter,
    liquidity: positionAfter.liquidity,
    amount0Min: 0,
    amount1Min: 0,
    deadline: Math.floor(await getNow(ethers.provider) + 8640000),
  })
  const wPowerPerpAmountInLPAfter = (isWethToken0) ? amount1After : amount0After;
  const wethAmountInLPAfter = (isWethToken0) ? amount0After : amount1After;
  // Changes
  const depositorEthDiff = depositorEthBalanceAfter.sub(depositorEthBalanceBefore)
  const depositorSqueethDiff = depositorSqueethBalanceAfter.sub(depositorSqueethBalanceBefore)
  const vaultEthDiff = vaultAfter.collateralAmount.sub(vaultBefore.collateralAmount)
  const vaultSqueethDiff = vaultAfter.shortAmount.sub(vaultBefore.shortAmount)
  const lpEthDiff = wethAmountInLPAfter.sub(wethAmountInLPBefore)
  const lpSqueethDiff = wPowerPerpAmountInLPAfter.sub(wPowerPerpAmountInLPBefore)

  // Assertions
  expect(flashLoanAmount.gt(BigNumber.from(0))).to.be.true
  expect(vaultSqueethDiff.eq(wPowerPerpAmountToMint)).to.be.true
  expect(vaultEthDiff.eq(wethAmountToDeposit)).to.be.true
  expect(lpSqueethDiff.add(wPowerPerpAmountInLPBefore.div(2)).lte(10)).to.be.true
  expect(lpEthDiff.add(wethAmountInLPBefore.div(2)).lte(10)).to.be.true
  expect(depositorSqueethDiff.sub(wPowerPerpAmountInLPBefore.div(2)).sub(wPowerPerpAmountToMint).abs().lte(10) ) 
})

})

describe("Rebalance LP in vault to just oSQTH", async () => {
  before("Mint new full range LP outside of vault" , async () => {
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
    const batchMintLpParams = {
      recipient: depositor.address,
      wPowerPerpPool: wSqueethPool.address,
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
    await controllerHelper.connect(depositor).wMintLp(batchMintLpParams, {value: collateralAmount.add(collateralToLp)});
   })

    
it("Close vault LP and open new one-sided LP with just oSQTH ", async () => {
  // Get vault and LP info
  const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)
  const depositorEthBalanceBefore = await ethers.provider.getBalance(depositor.address)
  const vaultId = (await shortSqueeth.nextId()).sub(1);
  const tokenIndex = await (positionManager as INonfungiblePositionManager).totalSupply();
  const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndex.sub(1));
  const positionBefore = await (positionManager as INonfungiblePositionManager).positions(tokenId)
  const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16)
  // Get current LP positions 
  const [amount0, amount1] = await (positionManager as INonfungiblePositionManager).connect(depositor).callStatic.decreaseLiquidity({
    tokenId: tokenId,
    liquidity: positionBefore.liquidity,
    amount0Min: 0,
    amount1Min: 0,
    deadline: Math.floor(await getNow(ethers.provider) + 8640000),
  })
  const wPowerPerpAmountInLPBefore = (isWethToken0) ? amount1 : amount0;
  const wethAmountInLPBefore = (isWethToken0) ? amount0 : amount1;
  // deposit nft to vault (approve first)
  await shortSqueeth.connect(depositor).approve(controller.address, vaultId);
  await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address)
  await (positionManager as INonfungiblePositionManager).connect(depositor).setApprovalForAll(controller.address, true) // approval for controller 
  await (positionManager as INonfungiblePositionManager).connect(depositor).setApprovalForAll(controllerHelper.address, true) // approve controllerHelper
  // Deposit nft to vault
  await controller.connect(depositor).depositUniPositionToken(vaultId, tokenId)
  const vaultBefore = await controller.vaults(vaultId);
  // Setup for mint of new LP
  const slot0 = await wSqueethPool.slot0()
  const currentTick = slot0[1]
  // Range above current tick
  const newTickLower = isWethToken0 ? 60*((currentTick - currentTick%60)/60 -2): 60*((currentTick - currentTick%60)/60  + 1)
  const newTickUpper = isWethToken0 ? 60*((currentTick - currentTick%60)/60 -1): 60*((currentTick - currentTick%60)/60 + 2)
  // No minimum
  const amount0Min = BigNumber.from(0);
  const amount1Min = BigNumber.from(0);
  // Estimate proceeds from liquidating weth in LP
  const wPowerPerpAmountOutFromSwap = await quoter.connect(depositor).callStatic.quoteExactInputSingle(weth.address,
    wSqueeth.address,
    3000,
    wethAmountInLPBefore,
    0)
  // Estimate of new LP with 0.01 wPowerPerp safety margin
  const wPowerPerpAmountToLp = wPowerPerpAmountInLPBefore.add(wPowerPerpAmountOutFromSwap).sub(ethers.utils.parseUnits('0.1'))
  // Setup rebalanceVaultNft call
  const abiCoder = new ethers.utils.AbiCoder
  const rebalanceLpInVaultParams = [
    {
      // Liquidate LP
      rebalanceLpInVaultType: BigNumber.from(1), // DecreaseLpLiquidity:
      // DecreaseLpLiquidityParams: [tokenId, liquidity, liquidityPercentage, amount0Min, amount1Min]
      data: abiCoder.encode(["uint256", 'uint256', 'uint256', 'uint128', 'uint128'],
       [tokenId, positionBefore.liquidity, BigNumber.from(100).mul(BigNumber.from(10).pow(16)), BigNumber.from(0), BigNumber.from(0)])
      },
      {
      // Sell all weth for oSQTH
      rebalanceLpInVaultType: BigNumber.from(5), // GeneralSwap:
        // GeneralSwap: [tokenIn, tokenOut, amountIn, limitPrice, poolFee]
        data: abiCoder.encode(["address", 'address', 'uint256', 'uint256','uint24'],
         [weth.address, wSqueeth.address, wethAmountInLPBefore, BigNumber.from(0), 3000])
        },
     {
       // Mint new LP 
       rebalanceLpInVaultType:  BigNumber.from(4), // MintNewLP
       // lpWPowerPerpPool: [recipient, wPowerPerpPool, vaultId, wPowerPerpAmount, collateralToDeposit, collateralToLP, amount0Min, amount1Min, lowerTick, upperTick ]
       data: abiCoder.encode(["address", "address", "uint256", 'uint256','uint256', 'uint256', 'uint256', 'uint256', 'int24', 'int24'],
        [controllerHelper.address, wSqueethPool.address, vaultId, wPowerPerpAmountToLp, BigNumber.from(0),  BigNumber.from(0), amount0Min, amount1Min, newTickLower, newTickUpper])
     }
  ]
  // Flashloan to cover complete removal of LP (rearrange collateral ratio formula for 1.5 and add 0.1 ETH safety margin)
  const normFactor = await controller.getExpectedNormalizationFactor()
  const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
  const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 1, true)

  const debtValueInEth = ((vaultBefore.shortAmount.add(wPowerPerpAmountToLp)).mul(ethPrice).mul(normFactor).div(one).div(one)).div(10000)
  // flashloan amount to cover withdrawn LP
  const flashLoanAmount = (debtValueInEth.mul(3).div(2)).sub(vaultBefore.collateralAmount).add(ethers.utils.parseUnits('0.01'))

  await controllerHelper.connect(depositor).rebalanceLpInVault(vaultId, flashLoanAmount, rebalanceLpInVaultParams);
  const depositorSqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
  const depositorEthBalanceAfter = await ethers.provider.getBalance(depositor.address)
  // Get new vault and LP info
  const vaultAfter = await controller.vaults(vaultId);
  const tokenIdAfter = vaultAfter.NftCollateralId;
  const positionAfter = await (positionManager as INonfungiblePositionManager).positions(tokenIdAfter)
  const [amount0After, amount1After] = await (positionManager as INonfungiblePositionManager).connect(controllerSigner).callStatic.decreaseLiquidity({
    tokenId: tokenIdAfter,
    liquidity: positionAfter.liquidity,
    amount0Min: 0,
    amount1Min: 0,
    deadline: Math.floor(await getNow(ethers.provider) + 8640000),
  })
  const wPowerPerpAmountInLPAfter = (isWethToken0) ? amount1After : amount0After;
  const wethAmountInLPAfter = (isWethToken0) ? amount0After : amount1After;
  // Changes
  const depositorEthDiff = depositorEthBalanceAfter.sub(depositorEthBalanceBefore)
  const depositorSqueethDiff = depositorSqueethBalanceAfter.sub(depositorSqueethBalanceBefore)
  const vaultEthDiff = vaultAfter.collateralAmount.sub(vaultBefore.collateralAmount)
  const vaultSqueethDiff = vaultAfter.shortAmount.sub(vaultBefore.shortAmount)
  const lpEthDiff = wethAmountInLPAfter.sub(wethAmountInLPBefore)
  const lpSqueethDiff = wPowerPerpAmountInLPAfter.sub(wPowerPerpAmountInLPBefore)
  // Assertions
  expect(flashLoanAmount.gte(0)).to.be.true
  expect(positionAfter.tickLower === newTickLower).to.be.true
  expect(positionAfter.tickUpper === newTickUpper).to.be.true
  expect(vaultAfter.shortAmount.eq(vaultBefore.shortAmount)).to.be.true
  expect(vaultAfter.collateralAmount.eq(vaultBefore.collateralAmount)).to.be.true
  expect(vaultAfter.NftCollateralId==vaultBefore.NftCollateralId).to.be.false
  expect(wethAmountInLPAfter.eq(BigNumber.from(0))).to.be.true
  expect(wPowerPerpAmountInLPAfter.sub(wPowerPerpAmountToLp).abs().lte(10)).to.be.true
    })
  })

  describe("Increase liquidity in vault with no eth added", async () => {
    before("Mint new full range LP outside of vault" , async () => {
      // Mint 50 squeeth in new vault with 2x collateral ratio
      const normFactor = await controller.getExpectedNormalizationFactor()
      const mintWSqueethAmount = ethers.utils.parseUnits('50')
      const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralAmount = debtInEth.mul(3)
      const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 1, true)
      const collateralToLp = mintWSqueethAmount.mul(squeethPrice).div(one)
      const batchMintLpParams = {
        recipient: depositor.address,
        wPowerPerpPool: wSqueethPool.address,
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
      await controllerHelper.connect(depositor).wMintLp(batchMintLpParams, {value: collateralAmount.add(collateralToLp)});
     })
  
      
  it("Deposit nft, withdraw collateral from vault, mint, increase liquidity with no eth added", async () => {
    // Get vault and LP info
    const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)
    const depositorEthBalanceBefore = await ethers.provider.getBalance(depositor.address)
    const vaultId = (await shortSqueeth.nextId()).sub(1);
    const tokenIndex = await (positionManager as INonfungiblePositionManager).totalSupply();
    const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndex.sub(1));
    const positionBefore = await (positionManager as INonfungiblePositionManager).positions(tokenId)
    const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16)
    // Get current LP positions 
    const [amount0, amount1] = await (positionManager as INonfungiblePositionManager).connect(depositor).callStatic.decreaseLiquidity({
      tokenId: tokenId,
      liquidity: positionBefore.liquidity,
      amount0Min: 0,
      amount1Min: 0,
      deadline: Math.floor(await getNow(ethers.provider) + 8640000),
    })
    const wPowerPerpAmountInLPBefore = (isWethToken0) ? amount1 : amount0;
    const wethAmountInLPBefore = (isWethToken0) ? amount0 : amount1;
    // deposit nft to vault (approve first)
    await shortSqueeth.connect(depositor).approve(controller.address, vaultId);
    await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address)
    await (positionManager as INonfungiblePositionManager).connect(depositor).setApprovalForAll(controller.address, true) // approval for controller 
    await (positionManager as INonfungiblePositionManager).connect(depositor).setApprovalForAll(controllerHelper.address, true) // approve controllerHelper
    // Deposit nft to vault
    await controller.connect(depositor).depositUniPositionToken(vaultId, tokenId)
    const vaultBefore = await controller.vaults(vaultId);
    // Double up LP
    const wPowerPerpAmountToLp = wPowerPerpAmountInLPBefore
    const wethAmountToLp = wethAmountInLPBefore
    const wPowerPerpAmountToMint = wPowerPerpAmountToLp
    // Setup rebalanceVaultNft call
    const abiCoder = new ethers.utils.AbiCoder
    // Start with overcollateralized vault with NFT
    // - Withdraw some eth (WithdrawFromVault)
    // - Mint some squeeth (DepositIntoVault)
    // - Increase LP liquidity (IncreaseLpLiquidity)
    const rebalanceLpInVaultParams = [
      {
        // Withdraw from vault
        rebalanceLpInVaultType: BigNumber.from(3), // WithdrawFromVault
        // withdrawFromVault: [wPowerPerpToBurn, collateralToWithdraw, burnExactRemoved ]
        data: abiCoder.encode(["uint256", 'uint256', 'bool'],
         [BigNumber.from(0), wethAmountToLp, false ])
        },
      {
        // Deposit into vault (no deposit)
        rebalanceLpInVaultType: BigNumber.from(2), // DepositIntoVault
        // DepsositIntoVault: [wPowerPerpToMint, collateralToDeposit]
        data: abiCoder.encode(["uint256", 'uint256'],
         [wPowerPerpAmountToMint, BigNumber.from(0)])
        },
      {
        // IncreaseLpLiquidity
        rebalanceLpInVaultType: BigNumber.from(0), // IncreaseLpLiquidity:
        // IncreaseLpLiquidityParam: [wPowerPerpPool, tokenId, wPowerPerpAmountToLp, collateralToDeposit, wethAmountToLp, amount0Min, amount1Min]
        data: abiCoder.encode(["address","uint256", 'uint256', 'uint256', 'uint256', 'uint256','uint256'],
         [wSqueethPool.address, tokenId, wPowerPerpAmountToLp, BigNumber.from(0), wethAmountToLp, BigNumber.from(0), BigNumber.from(0)])
        }
    ]
    // Flashloan to cover complete removal of LP (rearrange collateral ratio formula for 1.5 and add 0.1 ETH safety margin)
    const normFactor = await controller.getExpectedNormalizationFactor()
    const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
    const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 1, true)

    const debtValueInEth = ((vaultBefore.shortAmount.add(wPowerPerpAmountToMint)).mul(ethPrice).mul(normFactor).div(one).div(one)).div(10000)
    // flashloan amount to cover withdrawn LP
    const flashLoanAmount = (debtValueInEth.mul(3).div(2)).sub((vaultBefore.collateralAmount.sub(wethAmountToLp))).add(ethers.utils.parseUnits('0.01'))
    const tx = await controllerHelper.connect(depositor).rebalanceLpInVault(vaultId, flashLoanAmount, rebalanceLpInVaultParams);
    const receipt = await tx.wait()
    const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice)
    const depositorSqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
    const depositorEthBalanceAfter = await ethers.provider.getBalance(depositor.address)
    // Get new vault and LP info
    const vaultAfter = await controller.vaults(vaultId);
    const tokenIdAfter = vaultAfter.NftCollateralId;
    const positionAfter = await (positionManager as INonfungiblePositionManager).positions(tokenIdAfter)
    const [amount0After, amount1After] = await (positionManager as INonfungiblePositionManager).connect(controllerSigner).callStatic.decreaseLiquidity({
      tokenId: tokenIdAfter,
      liquidity: positionAfter.liquidity,
      amount0Min: 0,
      amount1Min: 0,
      deadline: Math.floor(await getNow(ethers.provider) + 8640000),
    })
    const wPowerPerpAmountInLPAfter = (isWethToken0) ? amount1After : amount0After;
    const wethAmountInLPAfter = (isWethToken0) ? amount0After : amount1After;
    // Changes
    const depositorEthDiff = depositorEthBalanceAfter.sub(depositorEthBalanceBefore)
    const depositorSqueethDiff = depositorSqueethBalanceAfter.sub(depositorSqueethBalanceBefore)
    const vaultEthDiff = vaultAfter.collateralAmount.sub(vaultBefore.collateralAmount)
    const vaultSqueethDiff = vaultAfter.shortAmount.sub(vaultBefore.shortAmount)
    const lpEthDiff = wethAmountInLPAfter.sub(wethAmountInLPBefore)
    const lpSqueethDiff = wPowerPerpAmountInLPAfter.sub(wPowerPerpAmountInLPBefore)
    // Assertions
    // flashloan amount should be positive
    expect(flashLoanAmount.gte(0)).to.be.true
    // expect(positionAfter.tickLower === newTickLower).to.be.true
    expect(vaultSqueethDiff.sub(wPowerPerpAmountToLp).eq(0)).to.be.true
    // LP eth comes from vault
    expect(vaultEthDiff.add(lpEthDiff).lte(10)).to.be.true
    // Nft id unchanged
    expect(vaultAfter.NftCollateralId==vaultBefore.NftCollateralId).to.be.true
    // Squeeth convervation
    expect(lpSqueethDiff.sub(vaultSqueethDiff).add(depositorSqueethDiff).abs().lte(10)).to.be.true
    // LP amount close to mint
    expect(lpSqueethDiff.sub(vaultSqueethDiff).lte(ethers.utils.parseUnits('0.1'))).to.be.true
    })
    })


    describe("Rebalance LP in vault: reduce oSQTH < debt, burn, withdraw >0 eth", async () => {
      before("Mint new full range LP outside of vault" , async () => {
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
        const batchMintLpParams = {
          recipient: depositor.address,
          wPowerPerpPool: wSqueethPool.address,
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
        await controllerHelper.connect(depositor).wMintLp(batchMintLpParams, {value: collateralAmount.add(collateralToLp)});
       })
    
        
    it("Reduce liquidity in LP, swap oSQTH for eth, deposit eth into vault, mint more oSQTH", async () => {
      // Get vault and LP info
      const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)
      const depositorEthBalanceBefore = await ethers.provider.getBalance(depositor.address)
      const vaultId = (await shortSqueeth.nextId()).sub(1);
      const tokenIndex = await (positionManager as INonfungiblePositionManager).totalSupply();
      const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndex.sub(1));
      const positionBefore = await (positionManager as INonfungiblePositionManager).positions(tokenId)
      const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16)
      // Get current LP positions 
      const [amount0, amount1] = await (positionManager as INonfungiblePositionManager).connect(depositor).callStatic.decreaseLiquidity({
        tokenId: tokenId,
        liquidity: positionBefore.liquidity,
        amount0Min: 0,
        amount1Min: 0,
        deadline: Math.floor(await getNow(ethers.provider) + 8640000),
      })
      const wPowerPerpAmountInLPBefore = (isWethToken0) ? amount1 : amount0;
      const wethAmountInLPBefore = (isWethToken0) ? amount0 : amount1;
      // deposit nft to vault (approve first)
      await shortSqueeth.connect(depositor).approve(controller.address, vaultId);
      await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address)
      await (positionManager as INonfungiblePositionManager).connect(depositor).setApprovalForAll(controller.address, true) // approval for controller 
      await (positionManager as INonfungiblePositionManager).connect(depositor).setApprovalForAll(controllerHelper.address, true) // approve controllerHelper
      // Deposit nft to vault
      await controller.connect(depositor).depositUniPositionToken(vaultId, tokenId)
      const vaultBefore = await controller.vaults(vaultId);
      // Swap withdrawn amount (less safety margin)
      const wPowerPerpToSwap = wPowerPerpAmountInLPBefore.div(2).sub(ethers.utils.parseUnits('0.01'))
      // Estimate eth amount needed to buy remaining oSQTH
      const ethAmountFromSwap = await quoter.connect(depositor).callStatic.quoteExactOutputSingle(weth.address,
        wSqueeth.address,
        3000,
        wPowerPerpToSwap,
        0)
      const ethAmountToDeposit = ethAmountFromSwap.add(wethAmountInLPBefore.div(2)).sub(ethers.utils.parseUnits('0.01'))
      // Setup rebalanceLpInVault call
      const abiCoder = new ethers.utils.AbiCoder
      const rebalanceLpInVaultParams = [
        {
          // Liquidate LP 50%
          rebalanceLpInVaultType: BigNumber.from(1), // DecreaseLpLiquidity:
          // DecreaseLpLiquidityParams: [tokenId, liquidity, liquidityPercentage, amount0Min, amount1Min]
          data: abiCoder.encode(["uint256", 'uint256', 'uint256', 'uint128', 'uint128'],
           [tokenId, positionBefore.liquidity, BigNumber.from(50).mul(BigNumber.from(10).pow(16)), BigNumber.from(0), BigNumber.from(0)])
          },
          {
            // Swap to eth
            rebalanceLpInVaultType: BigNumber.from(5), // GeneralSwap:
            // GeneralSwap: [tokenIn, tokenOut, amountIn, limitPrice, poolFee]
            data: abiCoder.encode(["address", 'address', 'uint256', 'uint256','uint24'],
            [wSqueeth.address, weth.address,  wPowerPerpToSwap, BigNumber.from(0), 3000])
          }  ,
          {
            // Deposit eth and mint more 
            rebalanceLpInVaultType: BigNumber.from(2), // DepositIntoVault
            // DepsositIntoVault: [wPowerPerpToMint, collateralToDeposit]
            data: abiCoder.encode(["uint256", 'uint256'],
             [wPowerPerpToSwap, ethAmountToDeposit.sub(ethers.utils.parseUnits('0.1'))])
            },
      ]
      // Flashloan to cover complete removal of LP (rearrange collateral ratio formula for 1.5 and add 0.1 ETH safety margin)
      const normFactor = await controller.getExpectedNormalizationFactor()
      const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
      const flashLoanAmount = (vaultBefore.shortAmount).mul(normFactor).mul(ethPrice).mul(3).div(one.mul(one).mul(10000).mul(2)).sub(vaultBefore.collateralAmount).add(ethers.utils.parseUnits('0.1'))
      await controllerHelper.connect(depositor).rebalanceLpInVault(vaultId, flashLoanAmount, rebalanceLpInVaultParams)
      const depositorSqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
      const depositorEthBalanceAfter = await ethers.provider.getBalance(depositor.address)
      // Get new vault and LP info
      const vaultAfter = await controller.vaults(vaultId);
      const tokenIdAfter = vaultAfter.NftCollateralId;
      const positionAfter = await (positionManager as INonfungiblePositionManager).positions(tokenIdAfter)
      const [amount0After, amount1After] = await (positionManager as INonfungiblePositionManager).connect(controllerSigner).callStatic.decreaseLiquidity({
        tokenId: tokenIdAfter,
        liquidity: positionAfter.liquidity,
        amount0Min: 0,
        amount1Min: 0,
        deadline: Math.floor(await getNow(ethers.provider) + 8640000),
      })
      const wPowerPerpAmountInLPAfter = (isWethToken0) ? amount1After : amount0After;
      const wethAmountInLPAfter = (isWethToken0) ? amount0After : amount1After;
      // Changes
      const depositorEthDiff = depositorEthBalanceAfter.sub(depositorEthBalanceBefore)
      const depositorSqueethDiff = depositorSqueethBalanceAfter.sub(depositorSqueethBalanceBefore)
      const vaultEthDiff = vaultAfter.collateralAmount.sub(vaultBefore.collateralAmount)
      const vaultSqueethDiff = vaultAfter.shortAmount.sub(vaultBefore.shortAmount)
      const lpEthDiff = wethAmountInLPAfter.sub(wethAmountInLPBefore)
      const lpSqueethDiff = wPowerPerpAmountInLPAfter.sub(wPowerPerpAmountInLPBefore)
      // Assertions
    
      // Correct amount minted
      expect(vaultSqueethDiff.sub(wPowerPerpToSwap).eq(0)).to.be.true
      // Eth deposited ~= target amount
      expect(vaultEthDiff.sub(ethAmountToDeposit.sub(ethers.utils.parseUnits('0.1'))).eq(0)).to.be.true
      // Nft id unchanged
      expect(vaultAfter.NftCollateralId==vaultBefore.NftCollateralId).to.be.true
        })
      })
    
      describe("Rebalance LP in vault: reduce oSQTH > debt, burn, withdraw >0 eth", async () => {
        
        before("Flashmint new LP with 200 oSQTH and withdraw all eth collateral", async () => {
          const normFactor = await controller.getExpectedNormalizationFactor()
          const mintWSqueethAmount = ethers.utils.parseUnits('200')
          const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
          const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
          const scaledEthPrice = ethPrice.div(10000)
          const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
          const collateralToDeposit = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
          const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 420, true)
          const collateralToLp = mintWSqueethAmount.mul(squeethPrice).div(one)
          const flashloanWMintDepositNftParams = {
            wPowerPerpPool: wSqueethPool.address,
            vaultId: 0,
            wPowerPerpAmount: mintWSqueethAmount,
            collateralToDeposit: collateralToDeposit,
            collateralToFlashloan: 0,
            collateralToLp: collateralToLp,
            collateralToWithdraw: 0,
            amount0Min: 0,
            amount1Min: 0,
            lowerTick: -887220,
            upperTick: 887220
          }    
          await controllerHelper.connect(depositor).flashloanWMintLpDepositNft(flashloanWMintDepositNftParams, {value: collateralToLp.add(collateralToDeposit).add(ethers.utils.parseUnits('0.01'))})
          // Burn half of short amount
          const wPowerPerpToBurn = mintWSqueethAmount.div(2)
          const vaultId = (await shortSqueeth.nextId()).sub(1);
          // Withdraw all vault collateral
          const collateralToWithdraw = collateralToDeposit
          await controller.connect(depositor).burnPowerPerpAmount(vaultId, wPowerPerpToBurn, collateralToWithdraw)
        })
        
      it("Withdraw oSQTH > vault debt from LP, burn, swap remainder, withdraw >0 eth", async () => {
        // Get vault and LP info
        const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)
        const depositorEthBalanceBefore = await ethers.provider.getBalance(depositor.address)
        const vaultId = (await shortSqueeth.nextId()).sub(1);
        const tokenIndex = await (positionManager as INonfungiblePositionManager).totalSupply();
        const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndex.sub(1));
        const positionBefore = await (positionManager as INonfungiblePositionManager).positions(tokenId)
        const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16)
        // Get current LPpositions 
        const [amount0, amount1] = await (positionManager as INonfungiblePositionManager).connect(controllerSigner).callStatic.decreaseLiquidity({
          tokenId: tokenId,
          liquidity: positionBefore.liquidity,
          amount0Min: 0,
          amount1Min: 0,
          deadline: Math.floor(await getNow(ethers.provider) + 8640000),
        })

        // Get current LP positions
        const ownerOfUniNFT = await (positionManager as INonfungiblePositionManager).ownerOf(tokenId)
        const wPowerPerpAmountInLPBefore = (isWethToken0) ? amount1 : amount0;
        const wethAmountInLPBefore = (isWethToken0) ? amount0 : amount1;
        // deposit nft to vault (approve first)
        await shortSqueeth.connect(depositor).approve(controller.address, vaultId);
        await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address)
        await (positionManager as INonfungiblePositionManager).connect(depositor).setApprovalForAll(controller.address, true) // approval for controller 
        await (positionManager as INonfungiblePositionManager).connect(depositor).setApprovalForAll(controllerHelper.address, true) // approve controllerHelper

        const vaultBefore = await controller.vaults(vaultId);
        // Burn whole debt
        const wPowerPerpToBurn = vaultBefore.shortAmount
        // Swap the remaining to eth (80% liquidated) less a safety margin
        const wPowerPerpAmountToSwap = wPowerPerpAmountInLPBefore.mul(80).div(100).sub(wPowerPerpToBurn).sub(ethers.utils.parseUnits('0.01'))

        // Setup rebalanceVaultNft call
        const abiCoder = new ethers.utils.AbiCoder
        const rebalanceLpInVaultParams = [
          {
            // Liquidate LP 80%
            rebalanceLpInVaultType: BigNumber.from(1), // DecreaseLpLiquidity:
            // DecreaseLpLiquidityParams: [tokenId, liquidity, liquidityPercentage, amount0Min, amount1Min]
            data: abiCoder.encode(["uint256", 'uint256', 'uint256', 'uint128', 'uint128'],
            [tokenId, positionBefore.liquidity, BigNumber.from(80).mul(BigNumber.from(10).pow(16)), BigNumber.from(0), BigNumber.from(0)])
          },
          
          {
            // Burn some withdrawn from LP
            rebalanceLpInVaultType: BigNumber.from(3), // WithdrawFromVault
            // withdrawFromVault: [wPowerPerpToBurn, collateralToWithdraw, burnExactRemoved ]
            data: abiCoder.encode(["uint256", 'uint256', 'bool'],
            [wPowerPerpToBurn, BigNumber.from(0), false ])
          },
          {
            // Sell all oSQTH for weth
            rebalanceLpInVaultType: BigNumber.from(5), // GeneralSwap:
            // GeneralSwap: [tokenIn, tokenOut, amountIn, limitPrice, poolFee]
            data: abiCoder.encode(["address", 'address', 'uint256', 'uint256','uint24'],
            [wSqueeth.address, weth.address, wPowerPerpAmountToSwap, BigNumber.from(0), 3000])
          }  
        ]
        // Flashloan to cover complete removal of LP (rearrange collateral ratio formula for 1.5 and add 0.1 ETH safety margin)
        const normFactor = await controller.getExpectedNormalizationFactor()
        const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
        const debtValueInEth = (vaultBefore.shortAmount.mul(ethPrice).mul(normFactor).div(one).div(one)).div(10000)
        // flashloan amount to cover withdrawn LP
        const flashLoanAmount = (debtValueInEth.mul(3).div(2)).sub(vaultBefore.collateralAmount).add(ethers.utils.parseUnits('0.01'))
        
        await controllerHelper.connect(depositor).rebalanceLpInVault(vaultId, flashLoanAmount, rebalanceLpInVaultParams);
        const depositorSqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
        const depositorEthBalanceAfter = await ethers.provider.getBalance(depositor.address)
        // Get new vault and LP info
        const vaultAfter = await controller.vaults(vaultId);
        const tokenIdAfter = vaultAfter.NftCollateralId;
        const positionAfter = await (positionManager as INonfungiblePositionManager).positions(tokenIdAfter)
        const [amount0After, amount1After] = await (positionManager as INonfungiblePositionManager).connect(controllerSigner).callStatic.decreaseLiquidity({
          tokenId: tokenIdAfter,
          liquidity: positionAfter.liquidity,
          amount0Min: 0,
          amount1Min: 0,
          deadline: Math.floor(await getNow(ethers.provider) + 8640000),
        })
        const wPowerPerpAmountInLPAfter = (isWethToken0) ? amount1After : amount0After;
        const wethAmountInLPAfter = (isWethToken0) ? amount0After : amount1After;
        // Changes
        const depositorEthDiff = depositorEthBalanceAfter.sub(depositorEthBalanceBefore)
        const depositorSqueethDiff = depositorSqueethBalanceAfter.sub(depositorSqueethBalanceBefore)
        const vaultEthDiff = vaultAfter.collateralAmount.sub(vaultBefore.collateralAmount)
        const vaultSqueethDiff = vaultAfter.shortAmount.sub(vaultBefore.shortAmount)
        const lpEthDiff = wethAmountInLPAfter.sub(wethAmountInLPBefore)
        const lpSqueethDiff = wPowerPerpAmountInLPAfter.sub(wPowerPerpAmountInLPBefore)
        // Assertions
        expect(vaultSqueethDiff.add(wPowerPerpToBurn).eq(0)).to.be.true
        // LP eth comes from vault
        expect(vaultEthDiff.eq(BigNumber.from(0))).to.be.true
        // Nft id unchanged
        expect(vaultAfter.NftCollateralId==vaultBefore.NftCollateralId).to.be.true
        // Squeeth convervation
        expect(wPowerPerpAmountInLPBefore.mul(80).div(100).sub(wPowerPerpToBurn).sub(wPowerPerpAmountToSwap).abs().lte(ethers.utils.parseUnits('0.01'))).to.be.true
          })
        })


      describe("Increase liquidity in vault with some eth added", async () => {
        before("Mint new full range LP outside of vault" , async () => {
          // Mint 50 squeeth in new vault with 2x collateral ratio
          const normFactor = await controller.getExpectedNormalizationFactor()
          const mintWSqueethAmount = ethers.utils.parseUnits('50')
          const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
          const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
          const scaledEthPrice = ethPrice.div(10000)
          const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
          const collateralAmount = debtInEth.mul(3)
          const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 1, true)
          const collateralToLp = mintWSqueethAmount.mul(squeethPrice).div(one)
          const batchMintLpParams = {
            recipient: depositor.address,
            wPowerPerpPool: wSqueethPool.address,
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
          await controllerHelper.connect(depositor).wMintLp(batchMintLpParams, {value: collateralAmount.add(collateralToLp)});
         })
      
          
      it("Deposit nft, withdraw collateral from vault, mint, increase liquidity with some eth added", async () => {
        // Get vault and LP info
        const depositorSqueethBalanceBefore = await wSqueeth.balanceOf(depositor.address)
        const depositorEthBalanceBefore = await ethers.provider.getBalance(depositor.address)
        const vaultId = (await shortSqueeth.nextId()).sub(1);
        const tokenIndex = await (positionManager as INonfungiblePositionManager).totalSupply();
        const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndex.sub(1));
        const positionBefore = await (positionManager as INonfungiblePositionManager).positions(tokenId)
        const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16)
        // Get current LP positions 
        const [amount0, amount1] = await (positionManager as INonfungiblePositionManager).connect(depositor).callStatic.decreaseLiquidity({
          tokenId: tokenId,
          liquidity: positionBefore.liquidity,
          amount0Min: 0,
          amount1Min: 0,
          deadline: Math.floor(await getNow(ethers.provider) + 8640000),
        })
        const wPowerPerpAmountInLPBefore = (isWethToken0) ? amount1 : amount0;
        const wethAmountInLPBefore = (isWethToken0) ? amount0 : amount1;
        // deposit nft to vault (approve first)
        await shortSqueeth.connect(depositor).approve(controller.address, vaultId);
        await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address)
        await (positionManager as INonfungiblePositionManager).connect(depositor).setApprovalForAll(controller.address, true) // approval for controller 
        await (positionManager as INonfungiblePositionManager).connect(depositor).setApprovalForAll(controllerHelper.address, true) // approve controllerHelper
        // Deposit nft to vault
        await controller.connect(depositor).depositUniPositionToken(vaultId, tokenId)
        const vault = await controller.vaults(vaultId);
        // Withdraw some collateral from vault
        await controller.connect(depositor).burnPowerPerpAmount(vaultId, 0, vault.collateralAmount.sub(wethAmountInLPBefore.div(2)).sub(ethers.utils.parseUnits('0.01')))

        // Withdraw all eth collateral
        const vaultBefore = await controller.vaults(vaultId);
        // Double up LP
        const wPowerPerpAmountToLp = wPowerPerpAmountInLPBefore
        const wethAmountToLp = wethAmountInLPBefore
        const wethAmountToWithdraw = wethAmountToLp.div(2)
        // Setup rebalanceVaultNft call
        const abiCoder = new ethers.utils.AbiCoder
        // Start with overcollateralized vault with NFT
        // - Withdraw some eth (WithdrawFromVault)
        // - Mint some squeeth (DepositIntoVault)
        // - Increase LP liquidity (IncreaseLpLiquidity)
        
        const rebalanceLpInVaultParams = [
          {
            // Withdraw from vault
            rebalanceLpInVaultType: BigNumber.from(3), // WithdrawFromVault
            // withdrawFromVault: [wPowerPerpToBurn, collateralToWithdraw, burnExactRemoved ]
            data: abiCoder.encode(["uint256", 'uint256', 'bool'],
             [BigNumber.from(0), wethAmountToWithdraw, false ])
            },
          {
            // Mint amount to LP
            rebalanceLpInVaultType: BigNumber.from(2), // DepositIntoVault
            // DepsositIntoVault: [wPowerPerpToMint, collateralToDeposit]
            data: abiCoder.encode(["uint256", 'uint256'],
             [wPowerPerpAmountToLp, BigNumber.from(0)])
            },
          {
            // IncreaseLpLiquidity
            rebalanceLpInVaultType: BigNumber.from(0), // IncreaseLpLiquidity:
            // IncreaseLpLiquidityParam: [tokenId, wPowerPerpAmountToLp, collateralToDeposit, wethAmountToLp, amount0Min, amount1Min]
            data: abiCoder.encode(["address", "uint256", 'uint256', 'uint256', 'uint256', 'uint256','uint256'],
             [wSqueethPool.address, tokenId, wPowerPerpAmountToLp, BigNumber.from(0), wethAmountToLp, BigNumber.from(0), BigNumber.from(0)])
            }
        ]
        // Flashloan to cover complete removal of LP (rearrange collateral ratio formula for 1.5 and add 0.1 ETH safety margin)
        const normFactor = await controller.getExpectedNormalizationFactor()
        const ethPrice = await oracle.getTwap(ethUsdcPool.address, weth.address, usdc.address, 420, true)
        const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 1, true)
        const debtValueInEth = ((vaultBefore.shortAmount.add(wPowerPerpAmountToLp)).mul(ethPrice).mul(normFactor).div(one).div(one)).div(10000)
        // flashloan amount to cover withdrawn LP
        const flashLoanAmount = (debtValueInEth.mul(3).div(2)).sub(vaultBefore.collateralAmount).add(wethAmountToWithdraw).add(ethers.utils.parseUnits('0.02'))
        const tx = await controllerHelper.connect(depositor).rebalanceLpInVault(vaultId, flashLoanAmount, rebalanceLpInVaultParams, {value: wethAmountToLp.div(2).add(ethers.utils.parseUnits('0.01'))});
        const receipt = await tx.wait()
        const gasSpent = receipt.gasUsed.mul(receipt.effectiveGasPrice)
        const depositorSqueethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
        const depositorEthBalanceAfter = await ethers.provider.getBalance(depositor.address)
        // Get new vault and LP info
        const vaultAfter = await controller.vaults(vaultId);
        const tokenIdAfter = vaultAfter.NftCollateralId;
        const positionAfter = await (positionManager as INonfungiblePositionManager).positions(tokenIdAfter)
        const [amount0After, amount1After] = await (positionManager as INonfungiblePositionManager).connect(controllerSigner).callStatic.decreaseLiquidity({
          tokenId: tokenIdAfter,
          liquidity: positionAfter.liquidity,
          amount0Min: 0,
          amount1Min: 0,
          deadline: Math.floor(await getNow(ethers.provider) + 8640000),
        })
        const wPowerPerpAmountInLPAfter = (isWethToken0) ? amount1After : amount0After;
        const wethAmountInLPAfter = (isWethToken0) ? amount0After : amount1After;
        // Changes
        const depositorEthDiff = depositorEthBalanceAfter.sub(depositorEthBalanceBefore)
        const depositorSqueethDiff = depositorSqueethBalanceAfter.sub(depositorSqueethBalanceBefore)
        const vaultEthDiff = vaultAfter.collateralAmount.sub(vaultBefore.collateralAmount)
        const vaultSqueethDiff = vaultAfter.shortAmount.sub(vaultBefore.shortAmount)
        const lpEthDiff = wethAmountInLPAfter.sub(wethAmountInLPBefore)
        const lpSqueethDiff = wPowerPerpAmountInLPAfter.sub(wPowerPerpAmountInLPBefore)
        // console.log('currentTick', currentTick)
        // console.log('positionAfter.TickLower', positionAfter.tickLower)
        // console.log('positionAfter.TickUpper', positionAfter.tickUpper)
        // console.log('wPowerPerpAmountInLPBefore', wPowerPerpAmountInLPBefore.toString())
        // console.log('wethAmountInLPBefore', wethAmountInLPBefore.toString())
        // console.log('wPowerPerpAmountInLPAfter', wPowerPerpAmountInLPAfter.toString())
        // console.log('wethAmountInLPAfter', wethAmountInLPAfter.toString())
        // console.log('vaultSqueethDiff',vaultSqueethDiff.toString() )
        // console.log('vaultEthDiff',vaultEthDiff.toString() )
        // console.log('lpSqueethDiff', lpSqueethDiff.toString())
        // console.log('lpEthDiff', lpEthDiff.toString())
        // console.log('depositorSqueethDiff', depositorSqueethDiff.toString())
        // console.log('vaultBefore.collateralAmount', vaultBefore.collateralAmount.toString())
        // console.log('vaultBefore.shortAmount', vaultBefore.shortAmount.toString())
        // console.log('vaultAfter.collateralAmount', vaultAfter.collateralAmount.toString())
        // console.log('vaultAfter.shortAmount', vaultAfter.shortAmount.toString())
        // console.log('wethAmountToLp',wethAmountToLp.toString())
        // console.log('flashloanAmount',flashLoanAmount.toString())
        // console.log('wPowerPerpAmountInLPBefore', wPowerPerpAmountInLPBefore.toString())
        // console.log('wPowerPerpAmountToLp', wPowerPerpAmountToLp.toString())
        // console.log('depositorEthDiff', depositorEthDiff.toString())
        // console.log('depositorSqueethDiff', depositorSqueethDiff.toString())
        // console.log('gasSpent', gasSpent.toString())

        // Assertions
        // Flashloan positive
        expect(flashLoanAmount.gt(0)).to.be.true
        // Target eth withdrawn from vault
        expect((vaultEthDiff.add(wethAmountToWithdraw)).abs().lte(10)).to.be.true
        // Target squeeth minted
        expect((vaultSqueethDiff.sub(wPowerPerpAmountToLp)).abs().lte(10)).to.be.true
        // Nft id unchanged
        expect(vaultAfter.NftCollateralId==vaultBefore.NftCollateralId).to.be.true
          })
        })




})

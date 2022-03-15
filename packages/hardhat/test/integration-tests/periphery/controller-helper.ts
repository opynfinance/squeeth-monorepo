import { ethers } from "hardhat"
import { expect } from "chai";
import { Contract, BigNumber, providers, constants } from "ethers";
import BigNumberJs from 'bignumber.js'

import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { WETH9, MockErc20, ShortPowerPerp, Controller, Oracle, WPowerPerp, ControllerHelper, INonfungiblePositionManager} from "../../../typechain";
import { deployUniswapV3, deploySqueethCoreContracts, deployWETHAndDai, addWethDaiLiquidity, addSqueethLiquidity } from '../../setup'
import { one, oracleScaleFactor, getNow } from "../../utils"

BigNumberJs.set({EXPONENTIAL_AT: 30})

describe("Controller helper integration test", function () {
  const startingEthPrice = 3000
  const startingEthPrice1e18 = BigNumber.from(startingEthPrice).mul(one) // 3000 * 1e18
  const scaledStartingSqueethPrice1e18 = startingEthPrice1e18.div(oracleScaleFactor) // 0.3 * 1e18
  const scaledStartingSqueethPrice = startingEthPrice / oracleScaleFactor.toNumber() // 0.3


  let provider: providers.JsonRpcProvider;
  let owner: SignerWithAddress;
  let depositor: SignerWithAddress;
  let feeRecipient: SignerWithAddress;
  let tester: SignerWithAddress
  let dai: MockErc20
  let weth: WETH9
  let positionManager: Contract
  let uniswapFactory: Contract
  let oracle: Oracle
  let controller: Controller
  let wSqueethPool: Contract
  let wSqueeth: WPowerPerp
  let ethDaiPool: Contract
  let controllerHelper: ControllerHelper
  let shortSqueeth: ShortPowerPerp
  let swapRouter: Contract

  this.beforeAll("Deploy uniswap protocol & setup uniswap pool", async() => {
    const accounts = await ethers.getSigners();
    const [_owner, _depositor, _feeRecipient, _tester ] = accounts;
    owner = _owner;
    depositor = _depositor;
    feeRecipient = _feeRecipient
    tester = _tester;
    provider = ethers.provider

    const { dai: daiToken, weth: wethToken } = await deployWETHAndDai()

    dai = daiToken
    weth = wethToken

    const uniDeployments = await deployUniswapV3(weth)
    positionManager = uniDeployments.positionManager
    uniswapFactory = uniDeployments.uniswapFactory
    swapRouter = uniDeployments.swapRouter

    // this will not deploy a new pool, only reuse old onces
    const squeethDeployments = await deploySqueethCoreContracts(
      weth,
      dai, 
      positionManager, 
      uniswapFactory,
      scaledStartingSqueethPrice,
      startingEthPrice
    )
    controller = squeethDeployments.controller
    wSqueeth = squeethDeployments.wsqueeth
    oracle = squeethDeployments.oracle
    shortSqueeth = squeethDeployments.shortSqueeth
    wSqueethPool = squeethDeployments.wsqueethEthPool
    ethDaiPool = squeethDeployments.ethDaiPool
    
    // const TickMath = await ethers.getContractFactory("TickMathExternal")
    // const TickMathLibrary = (await TickMath.deploy());
    // const SqrtPriceExternal = await ethers.getContractFactory("SqrtPriceMathPartial")
    // const SqrtPriceExternalLibrary = (await SqrtPriceExternal.deploy());  
    // const ControllerHelperLib = await ethers.getContractFactory("ControllerHelperLib")
    // const controllerHelperLib = (await ControllerHelperLib.deploy());  
    // const ControllerHelperContract = await ethers.getContractFactory("ControllerHelper", {libraries: {TickMathExternal: TickMathLibrary.address, SqrtPriceMathPartial: SqrtPriceExternalLibrary.address}});
    const ControllerHelperContract = await ethers.getContractFactory("ControllerHelper");
    controllerHelper = (await ControllerHelperContract.deploy(controller.address, oracle.address, shortSqueeth.address, wSqueethPool.address, wSqueeth.address, weth.address, swapRouter.address, positionManager.address, uniswapFactory.address, constants.AddressZero)) as ControllerHelper;
  })
  
  this.beforeAll("Seed pool liquidity", async() => {
    // add liquidity

    await addWethDaiLiquidity(
      startingEthPrice,
      ethers.utils.parseUnits('100'), // eth amount
      owner.address,
      dai,
      weth,
      positionManager
    )
    await provider.send("evm_increaseTime", [600])
    await provider.send("evm_mine", [])

    await addSqueethLiquidity(
      scaledStartingSqueethPrice, 
      '1000000',
      '2000000', 
      owner.address, 
      wSqueeth, 
      weth, 
      positionManager, 
      controller
    )
    await provider.send("evm_increaseTime", [600])
    await provider.send("evm_mine", [])
  })

  describe("Mint short with flash deposit", async () => {
    it("flash mint", async () => {      
      const normFactor = await controller.getExpectedNormalizationFactor()
      const mintWSqueethAmount = ethers.utils.parseUnits('10')
      const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralAmount = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
      await controller.connect(owner).mintWPowerPerpAmount(0, mintWSqueethAmount, 0, {value: collateralAmount})
      const swapParam = {
        tokenIn: wSqueeth.address,
        tokenOut: weth.address,
        fee: 3000,
        recipient: owner.address,
        deadline: Math.floor(await getNow(ethers.provider) + 8640000),
        amountIn: mintWSqueethAmount,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
      }    
      await wSqueeth.connect(owner).approve(swapRouter.address, constants.MaxUint256)
      const ethAmountOut = await swapRouter.connect(owner).callStatic.exactInputSingle(swapParam)
      const vaultId = await shortSqueeth.nextId();
      const slippage = BigNumber.from(3).mul(BigNumber.from(10).pow(16))
      const value = collateralAmount.sub(ethAmountOut.mul(one.sub(slippage)).div(one))
      const controllerBalanceBefore = await provider.getBalance(controller.address)
      const squeethBalanceBefore = await wSqueeth.balanceOf(depositor.address)
      const vaultBefore = await controller.vaults(vaultId)
      const depositorBalanceBefore = await provider.getBalance(depositor.address)
      const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 420, true)
      const ethToReceive = (mintWSqueethAmount.mul(squeethPrice).div(one)).mul(one.sub(slippage)).div(one)
      const params = {
        vaultId: 0,
        amountToFlashswap: collateralAmount.sub(value).toString(),
        totalCollateralToDeposit: collateralAmount.toString(),
        wPowerPerpAmount: mintWSqueethAmount.toString(),
        minToReceive: ethToReceive.toString()
      }

      await controllerHelper.connect(depositor).flashswapWMint(params, {value: value});

      const controllerBalanceAfter = await provider.getBalance(controller.address)
      const squeethBalanceAfter = await wSqueeth.balanceOf(depositor.address)
      const vaultAfter = await controller.vaults(vaultId)
      const depositorBalanceAfter = await provider.getBalance(depositor.address)

      expect(controllerBalanceBefore.add(collateralAmount).eq(controllerBalanceAfter)).to.be.true
      expect(squeethBalanceBefore.eq(squeethBalanceAfter)).to.be.true
      expect(vaultBefore.collateralAmount.add(collateralAmount).eq(vaultAfter.collateralAmount)).to.be.true
      expect(vaultBefore.shortAmount.add(mintWSqueethAmount).eq(vaultAfter.shortAmount)).to.be.true
      expect(depositorBalanceAfter.gt(depositorBalanceBefore.sub(value))).to.be.true
    })

    it("flash close short position and buy long", async () => {
      const vaultId = (await shortSqueeth.nextId()).sub(1);
      await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address)

      const vaultBefore = await controller.vaults(vaultId)
      const longBalanceBefore = await wSqueeth.balanceOf(depositor.address)
      const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 420, true)
      const squeethToBuy = vaultBefore.collateralAmount.div(squeethPrice)
      const params = {
        vaultId,
        wPowerPerpAmountToBurn: vaultBefore.shortAmount.toString(),
        wPowerPerpAmountToBuy: squeethToBuy.toString(),
        collateralToWithdraw: vaultBefore.collateralAmount.toString(),
        maxToPay: vaultBefore.collateralAmount.toString()
      }
      await controllerHelper.connect(depositor).flashswapWBurnBuyLong(params);

      const vaultAfter = await controller.vaults(vaultId)
      const longBalanceAfter = await wSqueeth.balanceOf(depositor.address)

      expect(vaultAfter.shortAmount.eq(BigNumber.from(0))).to.be.true
      expect(vaultAfter.collateralAmount.eq(BigNumber.from(0))).to.be.true
      expect(longBalanceAfter.sub(longBalanceBefore).eq(squeethToBuy)).to.be.true
    })
  })

  describe("Batch mint and LP", async () => {
    it("Batch mint and LP", async () => {
      const vaultId = (await shortSqueeth.nextId());

      const normFactor = await controller.getExpectedNormalizationFactor()
      const mintWSqueethAmount = ethers.utils.parseUnits('15')
      const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralAmount = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
      const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 420, true)
      const collateralToLp = mintWSqueethAmount.mul(squeethPrice).div(one)
      const vaultBefore = await controller.vaults(vaultId)
      const tokenIndexBefore = await (positionManager as INonfungiblePositionManager).totalSupply();

      await controllerHelper.connect(depositor).batchMintLp(0, mintWSqueethAmount, collateralAmount, collateralToLp, 0, 0, Math.floor(await getNow(ethers.provider) + 8640000), -887220, 887220, {value: collateralAmount.add(collateralToLp)});

      const vaultAfter = await controller.vaults(vaultId)
      const tokenIndexAfter = await (positionManager as INonfungiblePositionManager).totalSupply();
      const tokenId = await (positionManager as INonfungiblePositionManager).tokenByIndex(tokenIndexAfter.sub(1));
      const ownerOfUniNFT = await (positionManager as INonfungiblePositionManager).ownerOf(tokenId); 
      const position = await (positionManager as INonfungiblePositionManager).positions(tokenId)

      expect(position.tickLower === -887220).to.be.true
      expect(position.tickUpper === 887220).to.be.true
      expect(ownerOfUniNFT === depositor.address).to.be.true
      expect(tokenIndexAfter.sub(tokenIndexBefore).eq(BigNumber.from(1))).to.be.true
      expect(vaultBefore.shortAmount.eq(BigNumber.from(0))).to.be.true
      expect(vaultBefore.collateralAmount.eq(BigNumber.from(0))).to.be.true
      expect(vaultAfter.collateralAmount.eq(collateralAmount)).to.be.true
    })
  })

  describe("Sell long and flash mint short", async () => {
    before(async () => {
      let normFactor = await controller.normalizationFactor()
      let mintWSqueethAmount = ethers.utils.parseUnits('10')
      let mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      let ethPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 420, true)
      let scaledEthPrice = ethPrice.div(10000)
      let debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      let collateralAmount = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
      await controller.connect(depositor).mintWPowerPerpAmount(0, mintWSqueethAmount, 0, {value: collateralAmount})
      expect((await wSqueeth.balanceOf(depositor.address)).gte(mintWSqueethAmount)).to.be.true

      // minting mintWSqueethAmount to a tester address to get later how much should ETH to get for flahswap mintWSqueethAmount
      normFactor = await controller.normalizationFactor()
      mintWSqueethAmount = ethers.utils.parseUnits('20')
      mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      ethPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 420, true)
      scaledEthPrice = ethPrice.div(10000)
      debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      collateralAmount = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
      await controller.connect(tester).mintWPowerPerpAmount(0, mintWSqueethAmount, 0, {value: collateralAmount})
      expect((await wSqueeth.balanceOf(tester.address)).gte(mintWSqueethAmount)).to.be.true
    })

    it("Sell long and flashswap mint short positon", async () => {
      const longBalance = await wSqueeth.balanceOf(depositor.address);
      const vaultId = (await shortSqueeth.nextId()).sub(1);
      const normFactor = await controller.normalizationFactor()
      const mintWSqueethAmount = ethers.utils.parseUnits('20')
      const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralAmount = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
     
      const swapParam = {
        tokenIn: wSqueeth.address,
        tokenOut: weth.address,
        fee: 3000,
        recipient: owner.address,
        deadline: Math.floor(await getNow(ethers.provider) + 8640000),
        amountIn: longBalance,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
      }    
      await wSqueeth.connect(depositor).approve(swapRouter.address, constants.MaxUint256)
      const ethAmountOutFromSwap = await swapRouter.connect(depositor).callStatic.exactInputSingle(swapParam)

      const flashswapParam = {
        tokenIn: wSqueeth.address,
        tokenOut: weth.address,
        fee: 3000,
        recipient: owner.address,
        deadline: Math.floor(await getNow(ethers.provider) + 8640000),
        amountIn: await wSqueeth.balanceOf(tester.address),
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0
      }    
      await wSqueeth.connect(tester).approve(swapRouter.address, constants.MaxUint256)
      const ethAmountOutFromFlashSwap = await swapRouter.connect(tester).callStatic.exactInputSingle(flashswapParam)

      const slippage = BigNumber.from(3).mul(BigNumber.from(10).pow(16))
      const value = collateralAmount.sub(ethAmountOutFromSwap.mul(one.sub(slippage)).div(one)).sub(ethAmountOutFromFlashSwap.mul(one.sub(slippage)).div(one))
      const params = {
        vaultId: 0,
        wPowerPerpAmountToMint: mintWSqueethAmount,
        collateralAmount: collateralAmount,
        wPowerPerpAmountToSell: longBalance,
        minToReceive: BigNumber.from(0)
      }
      await wSqueeth.connect(depositor).approve(controllerHelper.address, longBalance)
      await controllerHelper.connect(depositor).flashswapSellLongWMint(params, {value: value})

      const vaultAfter = await controller.vaults(vaultId)

      expect((await wSqueeth.balanceOf(depositor.address)).eq(BigNumber.from(0))).to.be.true;
      expect(vaultAfter.shortAmount.eq(mintWSqueethAmount)).to.be.true
    })
  })

  describe("Close position with user wallet NFT: LP wPowerPerp amount is less than vault short amount", async () => {
    let tokenId: BigNumber;
    let mintWSqueethAmount : BigNumber = ethers.utils.parseUnits('10')

    before("open short and LP" , async () => {
      const normFactor = await controller.normalizationFactor()
      const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralAmount = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))
      const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 420, true)
      const collateralToLp = mintWSqueethAmount.mul(squeethPrice).div(one)

      await controller.connect(depositor).mintWPowerPerpAmount(0, mintWSqueethAmount, 0, {value: collateralAmount})

      const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16) 
      const token0 = isWethToken0 ? weth.address : wSqueeth.address
      const token1 = isWethToken0 ? wSqueeth.address : weth.address
  
      const mintParam = {
        token0,
        token1,
        fee: 3000,
        tickLower: -887220,// int24 min tick used when selecting full range
        tickUpper: 887220,// int24 max tick used when selecting full range
        amount0Desired: isWethToken0 ? collateralToLp : mintWSqueethAmount,
        amount1Desired: isWethToken0 ? mintWSqueethAmount : collateralToLp,
        amount0Min: 0,
        amount1Min: 0,
        recipient: depositor.address,
        deadline: Math.floor(await getNow(ethers.provider) + 8640000),// uint256
      }
  
      await weth.connect(depositor).deposit({value: collateralToLp})
      await weth.connect(depositor).approve(positionManager.address, ethers.constants.MaxUint256)
      await wSqueeth.connect(depositor).approve(positionManager.address, ethers.constants.MaxUint256)  
      const tx = await (positionManager as INonfungiblePositionManager).connect(depositor).mint(mintParam)
      const receipt = await tx.wait();
      tokenId = (receipt.events?.find(event => event.event === 'IncreaseLiquidity'))?.args?.tokenId;  
    })

    it("Close position with NFT from user", async () => {
      const vaultId = (await shortSqueeth.nextId()).sub(1);
      const vaultBefore = await controller.vaults(vaultId)
      const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16) 
      const amount0Min = BigNumber.from(0);
      const amount1Min = BigNumber.from(0);

      const positionBefore = await (positionManager as INonfungiblePositionManager).positions(tokenId);

      await (positionManager as INonfungiblePositionManager).connect(depositor).approve(positionManager.address, tokenId); 
      const [amount0, amount1] = await (positionManager as INonfungiblePositionManager).connect(depositor).callStatic.decreaseLiquidity({
        tokenId: tokenId,
        liquidity: positionBefore.liquidity,
        amount0Min: amount0Min,
        amount1Min: amount1Min,
        deadline: Math.floor(await getNow(ethers.provider) + 8640000),
      })
      const wPowerPerpAmountInLP = (isWethToken0) ? amount1 : amount0;
      const wethAmountInLP = (isWethToken0) ? amount0 : amount1;
      const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 420, true)
      const depositorEthBalanceBefore = await provider.getBalance(depositor.address)
      const slippage = BigNumber.from(3).mul(BigNumber.from(10).pow(16))
      const limitPriceEthPerPowerPerp = squeethPrice.mul(one.add(slippage)).div(one);

      await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address);
      await (positionManager as INonfungiblePositionManager).connect(depositor).approve(controllerHelper.address, tokenId); 
      await controllerHelper.connect(depositor).closeShortWithUserNft({
        vaultId, 
        tokenId,
        liquidityPercentage: BigNumber.from(1).mul(BigNumber.from(10).pow(18)),
        wPowerPerpAmountToBurn: mintWSqueethAmount, 
        collateralToWithdraw: vaultBefore.collateralAmount, 
        limitPriceEthPerPowerPerp,
        amount0Min: BigNumber.from(0), 
        amount1Min:BigNumber.from(0)
      })

      const positionAfter = await (positionManager as INonfungiblePositionManager).positions(tokenId);
      const vaultAfter = await controller.vaults(vaultId);
      const depositorEthBalanceAfter = await provider.getBalance(depositor.address)

      expect(positionAfter.liquidity.eq(BigNumber.from(0))).to.be.true
      expect(vaultAfter.shortAmount.eq(BigNumber.from(0))).to.be.true
      expect(vaultAfter.collateralAmount.eq(BigNumber.from(0))).to.be.true

      if(wPowerPerpAmountInLP.lt(mintWSqueethAmount)) {
        const ethToBuySqueeth = (mintWSqueethAmount.sub(wPowerPerpAmountInLP)).mul(squeethPrice).div(one); 
        const remainingETHFromLp = wethAmountInLP.sub(ethToBuySqueeth);

        expect(Number(depositorEthBalanceAfter.sub(depositorEthBalanceBefore).sub(vaultBefore.collateralAmount.add(remainingETHFromLp)).div(one).toString()) <= 0.01).to.be.true
      }
      else if (wPowerPerpAmountInLP.gt(mintWSqueethAmount)) {
        const wPowerPerpAmountToSell = wPowerPerpAmountInLP.sub(mintWSqueethAmount);
        const ethToGet = wPowerPerpAmountToSell.mul(squeethPrice).div(one);

        expect(Number(depositorEthBalanceAfter.sub(depositorEthBalanceBefore).sub(vaultBefore.collateralAmount.add(ethToGet)).div(one).toString()) <= 0.01).to.be.true
      }
    })
  })

  describe("Close second position with user wallet NFT from 1st short: (remove 100% liquidity) LP wPowerPerp amount is more than vault short amount", async () => {
    let tokenId: BigNumber;
    let mintWSqueethAmount: BigNumber;

    before("open first short position and LP" , async () => {
      const normFactor = await controller.normalizationFactor()
      const mintWSqueethAmountToLp : BigNumber = ethers.utils.parseUnits('20')
      const mintRSqueethAmount = mintWSqueethAmountToLp.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 420, true)
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
      const tx = await (positionManager as INonfungiblePositionManager).connect(depositor).mint(mintParam)
      const receipt = await tx.wait();
      tokenId = (receipt.events?.find(event => event.event === 'IncreaseLiquidity'))?.args?.tokenId;  
    })

    before("open short amount less than amount in LP position" , async () => {
      const normFactor = await controller.normalizationFactor()
      mintWSqueethAmount = ethers.utils.parseUnits('10')
      const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralAmount = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))

      await controller.connect(depositor).mintWPowerPerpAmount(0, mintWSqueethAmount, 0, {value: collateralAmount})
    })

    it("Close position with NFT from user", async () => {
      const vaultId = (await shortSqueeth.nextId()).sub(1);
      const vaultBefore = await controller.vaults(vaultId)
      const isWethToken0 : boolean = parseInt(weth.address, 16) < parseInt(wSqueeth.address, 16) 
      const amount0Min = BigNumber.from(0);
      const amount1Min = BigNumber.from(0);
      const positionBefore = await (positionManager as INonfungiblePositionManager).positions(tokenId);

      await (positionManager as INonfungiblePositionManager).connect(depositor).approve(positionManager.address, tokenId); 
      const [amount0, amount1] = await (positionManager as INonfungiblePositionManager).connect(depositor).callStatic.decreaseLiquidity({
        tokenId: tokenId,
        liquidity: positionBefore.liquidity,
        amount0Min: amount0Min,
        amount1Min: amount1Min,
        deadline: Math.floor(await getNow(ethers.provider) + 8640000),
      })
      const wPowerPerpAmountInLP = (isWethToken0) ? amount1 : amount0;
      const wethAmountInLP = (isWethToken0) ? amount0 : amount1;
      const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 420, true)
      const depositorEthBalanceBefore = await provider.getBalance(depositor.address)
      const slippage = BigNumber.from(3).mul(BigNumber.from(10).pow(16))
      const limitPriceEthPerPowerPerp = squeethPrice.mul(one.sub(slippage)).div(one);

      await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address);
      await (positionManager as INonfungiblePositionManager).connect(depositor).approve(controllerHelper.address, tokenId); 
      await controllerHelper.connect(depositor).closeShortWithUserNft({
        vaultId, 
        tokenId,
        liquidityPercentage: BigNumber.from(1).mul(BigNumber.from(10).pow(18)),
        wPowerPerpAmountToBurn: mintWSqueethAmount, 
        collateralToWithdraw: vaultBefore.collateralAmount, 
        limitPriceEthPerPowerPerp, 
        amount0Min: BigNumber.from(0), 
        amount1Min:BigNumber.from(0)
      })

      const positionAfter = await (positionManager as INonfungiblePositionManager).positions(tokenId);
      const vaultAfter = await controller.vaults(vaultId);
      const depositorEthBalanceAfter = await provider.getBalance(depositor.address)

      expect(positionAfter.liquidity.eq(BigNumber.from(0))).to.be.true
      expect(vaultAfter.shortAmount.eq(BigNumber.from(0))).to.be.true
      expect(vaultAfter.collateralAmount.eq(BigNumber.from(0))).to.be.true

      if(wPowerPerpAmountInLP.lt(mintWSqueethAmount)) {
        const ethToBuySqueeth = (mintWSqueethAmount.sub(wPowerPerpAmountInLP)).mul(squeethPrice).div(one); 
        const remainingETHFromLp = wethAmountInLP.sub(ethToBuySqueeth);

        expect(Number(depositorEthBalanceAfter.sub(depositorEthBalanceBefore).sub(vaultBefore.collateralAmount.add(remainingETHFromLp)).div(one).toString()) <= 0.01).to.be.true
      }
      else if (wPowerPerpAmountInLP.gt(mintWSqueethAmount)) {
        const wPowerPerpAmountToSell = wPowerPerpAmountInLP.sub(mintWSqueethAmount);
        const ethToGet = wPowerPerpAmountToSell.mul(squeethPrice).div(one);

        expect(Number(depositorEthBalanceAfter.sub(depositorEthBalanceBefore).sub(vaultBefore.collateralAmount.add(ethToGet).add(wethAmountInLP)).div(one).toString()) <= 0.01).to.be.true
      }
    })
  })

  describe("Close second position with user wallet NFT from 1st short: (remove 60% liquidity) LP wPowerPerp amount is more than vault short amount", async () => {
    let tokenId: BigNumber;
    let mintWSqueethAmount: BigNumber;

    before("open first short position and LP" , async () => {
      const normFactor = await controller.normalizationFactor()
      const mintWSqueethAmountToLp : BigNumber = ethers.utils.parseUnits('20')
      const mintRSqueethAmount = mintWSqueethAmountToLp.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 420, true)
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
      const tx = await (positionManager as INonfungiblePositionManager).connect(depositor).mint(mintParam)
      const receipt = await tx.wait();
      tokenId = (receipt.events?.find(event => event.event === 'IncreaseLiquidity'))?.args?.tokenId;  
    })

    before("open short amount less than amount in LP position" , async () => {
      const normFactor = await controller.normalizationFactor()
      mintWSqueethAmount = ethers.utils.parseUnits('10')
      const mintRSqueethAmount = mintWSqueethAmount.mul(normFactor).div(one)
      const ethPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 420, true)
      const scaledEthPrice = ethPrice.div(10000)
      const debtInEth = mintRSqueethAmount.mul(scaledEthPrice).div(one)
      const collateralAmount = debtInEth.mul(3).div(2).add(ethers.utils.parseUnits('0.01'))

      await controller.connect(depositor).mintWPowerPerpAmount(0, mintWSqueethAmount, 0, {value: collateralAmount})
    })

    it("Close position with NFT from user", async () => {
      const vaultId = (await shortSqueeth.nextId()).sub(1);
      const vaultBefore = await controller.vaults(vaultId)
      const amount0Min = BigNumber.from(0);
      const amount1Min = BigNumber.from(0);
      const positionBefore = await (positionManager as INonfungiblePositionManager).positions(tokenId);

      await (positionManager as INonfungiblePositionManager).connect(depositor).approve(positionManager.address, tokenId); 
      const [amount0, amount1] = await (positionManager as INonfungiblePositionManager).connect(depositor).callStatic.decreaseLiquidity({
        tokenId: tokenId,
        liquidity: positionBefore.liquidity,
        amount0Min: amount0Min,
        amount1Min: amount1Min,
        deadline: Math.floor(await getNow(ethers.provider) + 8640000),
      })
      const squeethPrice = await oracle.getTwap(wSqueethPool.address, wSqueeth.address, weth.address, 420, true)
      const slippage = BigNumber.from(3).mul(BigNumber.from(10).pow(16))
      const limitPriceEthPerPowerPerp = squeethPrice.mul(one.sub(slippage)).div(one);

      await controller.connect(depositor).updateOperator(vaultId, controllerHelper.address);
      await (positionManager as INonfungiblePositionManager).connect(depositor).approve(controllerHelper.address, tokenId); 
      await controllerHelper.connect(depositor).closeShortWithUserNft({
        vaultId, 
        tokenId,
        liquidityPercentage: BigNumber.from(6).mul(BigNumber.from(10).pow(17)),
        wPowerPerpAmountToBurn: mintWSqueethAmount, 
        collateralToWithdraw: vaultBefore.collateralAmount, 
        limitPriceEthPerPowerPerp, 
        amount0Min: BigNumber.from(0), 
        amount1Min:BigNumber.from(0)
      })

      const positionAfter = await (positionManager as INonfungiblePositionManager).positions(tokenId);
      const vaultAfter = await controller.vaults(vaultId);

      expect(positionAfter.liquidity.sub(positionBefore.liquidity.div(2)).lte(1)).to.be.true
      expect(vaultAfter.shortAmount.eq(BigNumber.from(0))).to.be.true
      expect(vaultAfter.collateralAmount.eq(BigNumber.from(0))).to.be.true
    })
  })
})
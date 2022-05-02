import { ethers } from "hardhat"
import BigNumberJs from 'bignumber.js'
import { Contract, BigNumber, constants } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { Controller, INonfungiblePositionManager, ISwapRouter, IUniswapV3Pool, MockErc20, Oracle, VaultLibTester, ShortPowerPerp, WETH9, WPowerPerp, LiquidationHelper } from "../../../typechain";
import { deployUniswapV3, deploySqueethCoreContracts, deployWETHAndDai, addSqueethLiquidity, addWethDaiLiquidity } from '../setup'
import { isSimilar, getNow, one, oracleScaleFactor } from "../utils";
import { getSqrtPriceAndTickBySqueethPrice } from "../calculator";

const TICK_SPACE = 60

// make sure .toString won't return string like 3.73e+22
BigNumberJs.set({EXPONENTIAL_AT: 30})

describe("Liquidation Integration Test", function () {
  let oracle: Oracle;
  let dai: MockErc20
  let weth: WETH9
  let squeeth: WPowerPerp
  let shortSqueeth: ShortPowerPerp
  let positionManager: INonfungiblePositionManager
  let controller: Controller
  let liquidationHelper: LiquidationHelper
  let swapRouter: Contract

  const provider = ethers.provider
  let squeethPool: Contract
  let ethDaiPool: Contract

  let vaultLib: VaultLibTester

  const startingEthPrice = 3000
  const startingEthPrice1e18 = BigNumber.from(startingEthPrice).mul(one) // 3000 * 1e18

  const scaledStartingSqueethPrice1e18 = startingEthPrice1e18.div(oracleScaleFactor) // 0.3 * 1e18
  
  const scaledStartingSqueethPrice = startingEthPrice / oracleScaleFactor.toNumber() // 0.3
  
  let liquidityProvider: SignerWithAddress
  let seller0: SignerWithAddress
  let seller1: SignerWithAddress
  let seller2: SignerWithAddress
  let seller3: SignerWithAddress
  let seller4: SignerWithAddress
  let seller5: SignerWithAddress
  let seller6: SignerWithAddress
  let liquidator: SignerWithAddress

  const humanReadableMintAmount = '100'

  // vault0: normal vault to be liquidated
  let vault0Id: BigNumber
  const vault0Collateral = ethers.utils.parseUnits('45.1')
  const vault0MintAmount = ethers.utils.parseUnits(humanReadableMintAmount)
  
  // vault1: normal vault need to be fully liquidated, don't have enough collateral to payout all debt
  let vault1Id: BigNumber
  const vault1Collateral = ethers.utils.parseUnits('0.91') // almost perfect amount of collateral given the price is 3000
  const vault1MintAmount = ethers.utils.parseUnits('2')

  // vault2: normal vault need to be fully liquidated, have enough collateral to payout all debt
  let vault2Id: BigNumber
  const vault2MintAmount = ethers.utils.parseUnits('1')
  const vault2Collateral = ethers.utils.parseUnits('0.7') // enough collateral can pay out liquidator, but still underwater if price is up to 6000

  // vault3: with NFT; safe after reduceDebt
  let vault3Id: BigNumber
  let vault3LPTokenId: number
  const vault3Collateral = ethers.utils.parseUnits('45.1')
  const vault3MintAmount = ethers.utils.parseUnits(humanReadableMintAmount)

  // vault4: with NFT; safe after reduceDebt (same as vault 3, for user to save)
  let vault4Id: BigNumber
  let vault4LPTokenId: number
  const vault4Collateral = ethers.utils.parseUnits('45.1')
  const vault4MintAmount = ethers.utils.parseUnits(humanReadableMintAmount)
  
  // vault5: with NFT; not safe after reduceDebt, can be liquidated when price 8x
  // can only be liquidated by 50% in each tx. 
  let vault5Id: BigNumber
  let vault5LPTokenId: number
  const vault5Collateral = ethers.utils.parseUnits('45.1')
  const vault5MintAmount = ethers.utils.parseUnits(humanReadableMintAmount)

  // vault6: with NFT full eth; not safe after reduceDebt, C21, have enough collateral to pay all debt
  let vault6Id: BigNumber
  const vault6MintAmount = ethers.utils.parseUnits('1')
  const vault6Collateral = ethers.utils.parseUnits('0.2')
  const vault6UniEthAmount = ethers.utils.parseUnits('0.5')
  let vault6LPTokenId: number


  this.beforeAll("Prepare accounts", async() => {
    const accounts = await ethers.getSigners()
    liquidityProvider = accounts[0]
    seller0 = accounts[1]
    seller1 = accounts[2]
    seller2 = accounts[3]
    seller3 = accounts[4]
    seller4 = accounts[5]
    seller5 = accounts[6]
    seller6 = accounts[7]
    liquidator = accounts[9]
  })

  this.beforeAll("Deploy uniswap protocol & setup uniswap pool", async() => {
  
    const { dai: daiToken, weth: wethToken } = await deployWETHAndDai()

    dai = daiToken
    weth = wethToken

    const uniDeployments = await deployUniswapV3(weth)
    const coreDeployments = await deploySqueethCoreContracts(
      weth,
      dai, 
      uniDeployments.positionManager, 
      uniDeployments.uniswapFactory,
      scaledStartingSqueethPrice,
      startingEthPrice
    )

    positionManager = (uniDeployments.positionManager) as INonfungiblePositionManager
    swapRouter = uniDeployments.swapRouter

    squeeth = coreDeployments.wsqueeth
    shortSqueeth = coreDeployments.shortSqueeth
    controller = coreDeployments.controller
    squeethPool = coreDeployments.wsqueethEthPool
    ethDaiPool = coreDeployments.ethDaiPool
    oracle = coreDeployments.oracle

    const SqrtPriceExternal = await ethers.getContractFactory("SqrtPriceMathPartial")
    const SqrtPriceExternalLibrary = (await SqrtPriceExternal.deploy());

    const TickMathExternal = await ethers.getContractFactory("TickMathExternal")
    const TickMathLibrary = (await TickMathExternal.deploy());

    const VaultTester = await ethers.getContractFactory("VaultLibTester", {libraries: {TickMathExternal: TickMathLibrary.address, SqrtPriceMathPartial: SqrtPriceExternalLibrary.address}});
    vaultLib = (await VaultTester.deploy()) as VaultLibTester;

    const LiqHelperFactory = await ethers.getContractFactory("LiquidationHelper", {libraries: {TickMathExternal: TickMathLibrary.address, SqrtPriceMathPartial: SqrtPriceExternalLibrary.address}});

    liquidationHelper = await LiqHelperFactory.deploy(
        controller.address,
        oracle.address,
        squeeth.address,
        weth.address,
        dai.address,
        ethDaiPool.address,
        squeethPool.address,
        positionManager.address
      ) as LiquidationHelper;
  })

  this.beforeAll('Add liquidity to both pools', async() => {
    await addSqueethLiquidity(
      scaledStartingSqueethPrice, 
      '5',
      '30', 
      liquidityProvider.address, 
      squeeth, 
      weth, 
      positionManager, 
      controller
    )

    await addWethDaiLiquidity(
      startingEthPrice,
      ethers.utils.parseUnits('10'), // eth amount
      liquidityProvider.address,
      dai,
      weth,
      positionManager
    )
  })

  this.beforeAll('Prepare vault0 (normal)', async() => {
    vault0Id = await shortSqueeth.nextId()

    
    await controller.connect(seller0).mintPowerPerpAmount(0, vault0MintAmount, 0, {value: vault0Collateral})
  })

  this.beforeAll('Prepare vault1 (normal)', async() => {
    vault1Id = await shortSqueeth.nextId()
    await controller.connect(seller1).mintPowerPerpAmount(0, vault1MintAmount, 0, {value: vault1Collateral})
  })

  this.beforeAll('Prepare vault2 (normal)', async() => {
    vault2Id = await shortSqueeth.nextId()
    await controller.connect(seller2).mintPowerPerpAmount(0, vault2MintAmount, 0, {value: vault2Collateral})
  })

  this.beforeAll('Prepare vault3 (with nft), dealing with cases when it\'s safe after saving', async() => {
    vault3Id = await shortSqueeth.nextId()

    
    await controller.connect(seller3).mintPowerPerpAmount(0, vault3MintAmount, 0, {value: vault3Collateral})

    vault3LPTokenId = await addSqueethLiquidity(
      scaledStartingSqueethPrice,
      humanReadableMintAmount,
      '45.1',
      liquidityProvider.address,
      squeeth,
      weth,
      positionManager,
      controller
    )
    await (positionManager as INonfungiblePositionManager).connect(liquidityProvider).transferFrom(liquidityProvider.address, seller3.address, vault3LPTokenId)
    await (positionManager as INonfungiblePositionManager).connect(seller3).approve(controller.address, vault3LPTokenId)

    await controller.connect(seller3).depositUniPositionToken(vault3Id, vault3LPTokenId)
    const vault = await controller.vaults(vault3Id)
    expect(vault.NftCollateralId === vault3LPTokenId).to.be.true
  })

  this.beforeAll('Prepare vault4 (with nft), dealing with cases when it\'s safe after saving', async() => {
    // vault4 is identical to vault3
    vault4Id = await shortSqueeth.nextId()

    await controller.connect(seller4).mintPowerPerpAmount(0, vault4MintAmount, 0, {value: vault4Collateral})

    vault4LPTokenId = await addSqueethLiquidity(
      scaledStartingSqueethPrice,
      humanReadableMintAmount,
      '45.1',
      liquidityProvider.address,
      squeeth,
      weth,
      positionManager,
      controller
    )
    await (positionManager as INonfungiblePositionManager).connect(liquidityProvider).transferFrom(liquidityProvider.address, seller4.address, vault4LPTokenId)
    await (positionManager as INonfungiblePositionManager).connect(seller4).approve(controller.address, vault4LPTokenId)

    await controller.connect(seller4).depositUniPositionToken(vault4Id, vault4LPTokenId)
    const vault = await controller.vaults(vault4Id)
    expect(vault.NftCollateralId === vault4LPTokenId).to.be.true
  })

  this.beforeAll('Prepare vault5 (with nft), for liquidation', async() => {
    vault5Id = await shortSqueeth.nextId()

    await controller.connect(seller5).mintPowerPerpAmount(0, vault5MintAmount, 0, {value: vault5Collateral})

    vault5LPTokenId = await addSqueethLiquidity(
      scaledStartingSqueethPrice,
      humanReadableMintAmount,
      '45.1',
      liquidityProvider.address,
      squeeth,
      weth,
      positionManager,
      controller
    )
    await positionManager.connect(liquidityProvider).transferFrom(liquidityProvider.address, seller5.address, vault5LPTokenId)
    await positionManager.connect(seller5).approve(controller.address, vault5LPTokenId)

    await controller.connect(seller5).depositUniPositionToken(vault5Id, vault5LPTokenId)
    const vault = await controller.vaults(vault5Id)
    expect(vault.NftCollateralId === vault5LPTokenId).to.be.true
  })

  this.beforeAll('Prepare vault6 (with all eth nft), for liquidation', async() => {
    vault6Id = await shortSqueeth.nextId()

    const isWethToken0 = parseInt(weth.address, 16) < parseInt(squeeth.address, 16) 

    // create a uni position that's [1000, 2000], so it's now all eth
    const scaledPrice2000 = BigNumber.from('2000').mul(one).div(oracleScaleFactor)
    const scaledPrice1000 = BigNumber.from('1000').mul(one).div(oracleScaleFactor)
    const { tick: tick1000 } = getSqrtPriceAndTickBySqueethPrice(scaledPrice1000, isWethToken0)
    const { tick: tick2000 } = getSqrtPriceAndTickBySqueethPrice(scaledPrice2000, isWethToken0)
    const tickUpper = isWethToken0 ? tick1000 : tick2000;
    const tickLower = isWethToken0 ? tick2000 : tick1000;
    const tickUpperToUse = Math.ceil(parseInt(tickUpper, 10) / TICK_SPACE) * TICK_SPACE
    const tickLowerToUse = Math.ceil(parseInt(tickLower, 10) / TICK_SPACE) * TICK_SPACE
    const token0 = isWethToken0 ? weth.address : squeeth.address
    const token1 = isWethToken0 ? squeeth.address : weth.address

    // uni position is all ETH
    const mintParam = {
      token0,
      token1,
      fee: 3000,
      tickLower: tickLowerToUse,
      tickUpper: tickUpperToUse,
      amount0Desired: isWethToken0 ? vault6UniEthAmount : 0,
      amount1Desired: isWethToken0 ? 0 : vault6UniEthAmount,
      amount0Min: 0,
      amount1Min: 0,
      recipient: seller6.address,
      deadline: Math.floor(await getNow(ethers.provider) + 8640000),// uint256
    }

    await weth.connect(seller6).deposit({value: vault6UniEthAmount})
    await weth.connect(seller6).approve(positionManager.address, constants.MaxUint256)
    const tx = await positionManager.connect(seller6).mint(mintParam)

    const receipt = await tx.wait();
    vault6LPTokenId = (receipt.events?.find(event => event.event === 'IncreaseLiquidity'))?.args?.tokenId.toNumber();

    await positionManager.connect(seller6).approve(controller.address, vault6LPTokenId)

    await controller.connect(seller6).mintPowerPerpAmount(0, vault6MintAmount, vault6LPTokenId, {value: vault6Collateral})
    const vault = await controller.vaults(vault6Id)
    expect(vault.NftCollateralId === vault6LPTokenId).to.be.true
  })

  describe('Liquidate normal vault when price is 2x', async( )=> {
    before('push squeeth price higher 2x', async() => {
      // set squeeth price higher by buying half of squeeth in the pool
      const poolSqueethBalance = await squeeth.balanceOf(squeethPool.address)

      const maxWeth = poolSqueethBalance.mul(scaledStartingSqueethPrice1e18).mul(5).div(one)
      
      // how much squeeth to buy to make the price 2x
      const newPoolSqueethBalance = new BigNumberJs(poolSqueethBalance.toString()).div(Math.SQRT2).integerValue().toString()
      const squeethToBuy = poolSqueethBalance.sub(newPoolSqueethBalance)
      
      const exactOutputParam = {
        tokenIn: weth.address,
        tokenOut: squeeth.address,
        fee: 3000,
        recipient: liquidityProvider.address,
        deadline: await getNow(provider) + 86400,
        amountOut: squeethToBuy,
        amountInMaximum: maxWeth,
        sqrtPriceLimitX96: 0,
      }

      await weth.connect(liquidityProvider).deposit({value: maxWeth})
      await weth.connect(liquidityProvider).approve(swapRouter.address, ethers.constants.MaxUint256)      
      await (swapRouter as ISwapRouter).connect(liquidityProvider).exactOutputSingle(exactOutputParam)

      // make sure price is set correctly
      await provider.send("evm_increaseTime", [10]) // increase time by 10 sec
      await provider.send("evm_mine", [])
      const newSqueethPrice = await oracle.getTwap(squeethPool.address, squeeth.address, weth.address, 1, true)
      expect(isSimilar(newSqueethPrice.toString(), (scaledStartingSqueethPrice1e18.mul(2)).toString())).to.be.true
    })
    before('push weth price higher 2x', async() => {
      // set weth price higher by buying half of weth in the pool
      const poolWethBalance = await weth.balanceOf(ethDaiPool.address)

      const maxDai = poolWethBalance.mul(startingEthPrice).mul(5)

      const newPoolBalance = new BigNumberJs(poolWethBalance.toString()).div(Math.SQRT2).integerValue().toString()
      const amountWethToBuy = poolWethBalance.sub(newPoolBalance)

      const exactOutputParam = {
        tokenIn: dai.address,
        tokenOut: weth.address,
        fee: 3000,
        recipient: liquidityProvider.address,
        deadline: await getNow(provider) + 86400,
        amountOut: amountWethToBuy,
        amountInMaximum: maxDai,
        sqrtPriceLimitX96: 0,
      }

      await dai.connect(liquidityProvider).mint(liquidityProvider.address, maxDai, )
      await dai.connect(liquidityProvider).approve(swapRouter.address, ethers.constants.MaxUint256)      
      await (swapRouter as ISwapRouter).connect(liquidityProvider).exactOutputSingle(exactOutputParam)

      // make sure price is set correctly
      await provider.send("evm_increaseTime", [10]) // increase time by 10 sec
      await provider.send("evm_mine", [])
      const newWethPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 1, false)
      expect(isSimilar(newWethPrice.toString(), startingEthPrice1e18.mul(2).toString())).to.be.true
    })
    before('increase block time to make sure TWAP is updated', async() => {
      await provider.send("evm_increaseTime", [3600]) // increase time by 60 mins
      await provider.send("evm_mine", [])

      const newEthPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 3600, false)
      const newSqueethPrice = await oracle.getTwap(squeethPool.address, squeeth.address, weth.address, 3600, false)
      expect(isSimilar(newEthPrice.toString(), newSqueethPrice.mul(oracleScaleFactor).toString(), 3)).to.be.true
    })

    before('prepare liquidator to liquidate vault 0 and vault 1', async() => {
      const newEthPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 600, false)
      const vaultBefore = await controller.vaults(vault0Id)
      
      const mintAmount = vaultBefore.shortAmount.mul(2)
      const collateralRequired = mintAmount.mul(newEthPrice).mul(2).div(oracleScaleFactor).div(one).mul(2)

      // mint squeeth to liquidate vault0!
      await controller.connect(liquidator).mintPowerPerpAmount(0, mintAmount, 0, {value: collateralRequired})
      
    })
    
    it("liquidate vault 0", async () => {

      const newSqueethPrice = await oracle.getTwap(squeethPool.address, squeeth.address, weth.address, 600, false)

      const vaultBefore = await controller.vaults(vault0Id)
      
      // state before liquidation
      const liquidatorSqueethBefore = await squeeth.balanceOf(liquidator.address)
      const liquidatorBalanceBefore = await provider.getBalance(liquidator.address)

      const wSqueethAmountToLiquidate = vaultBefore.shortAmount.div(2)

      const result = await liquidationHelper.checkLiquidation(vault0Id);
      const [isUnsafe, isLiquidatableAfterReducingDebt, maxWPowerPerpAmount, collateralToReceive] = result;

      await controller.connect(liquidator).liquidate(vault0Id, wSqueethAmountToLiquidate);
      
      const collateralToGet = newSqueethPrice.mul(wSqueethAmountToLiquidate).div(one).mul(11).div(10)

      const vaultAfter = await controller.vaults(vault0Id)
      const liquidatorBalanceAfter = await provider.getBalance(liquidator.address)
      const liquidatorSqueethAfter = await squeeth.balanceOf(liquidator.address)

      expect(isUnsafe).to.be.true
      expect(isLiquidatableAfterReducingDebt).to.be.true
      expect(maxWPowerPerpAmount.eq((vaultBefore.shortAmount).div(2))).to.be.true
      expect(isSimilar(collateralToReceive.toString(), collateralToGet.toString())).to.be.true
      
      // expect(collateralToGet.eq(liquidatorBalanceAfter.sub(liquidatorBalanceBefore))).to.be.true
      expect(vaultBefore.shortAmount.sub(vaultAfter.shortAmount).eq(liquidatorSqueethBefore.sub(liquidatorSqueethAfter))).to.be.true
    })

    it('should revert if trying to leave vault1 a dust vault', async() => {
      const vaultBefore = await controller.vaults(vault1Id)
      const wSqueethAmountToLiquidate = vaultBefore.shortAmount.div(2)
      await expect(controller.connect(liquidator).liquidate(vault1Id, wSqueethAmountToLiquidate)).to.be.revertedWith('C22')
    })

    it("fully liquidate vault 1, get the full collateral amount from the vault", async () => {
      const vaultBefore = await controller.vaults(vault1Id)
      
      // state before liquidation
      const liquidatorSqueethBefore = await squeeth.balanceOf(liquidator.address)
      const liquidatorBalanceBefore = await provider.getBalance(liquidator.address)

      // liquidate the full vault
      const wSqueethAmountToLiquidate = vaultBefore.shortAmount

      const result = await liquidationHelper.checkLiquidation(vault1Id);
      const [isUnsafe, isLiquidatableAfterReducingDebt, maxWPowerPerpAmount, collateralToReceive] = result;

      await controller.connect(liquidator).liquidate(vault1Id, wSqueethAmountToLiquidate);
      const vaultAfter = await controller.vaults(vault1Id)
      const liquidatorBalanceAfter = await provider.getBalance(liquidator.address)
      const liquidatorSqueethAfter = await squeeth.balanceOf(liquidator.address)

      expect(isUnsafe).to.be.true
      expect(isLiquidatableAfterReducingDebt).to.be.true
      expect(maxWPowerPerpAmount.eq((vaultBefore.shortAmount))).to.be.true
      expect(isSimilar(collateralToReceive.toString(), (vaultBefore.collateralAmount).toString())).to.be.true

      // expect(vaultBefore.collateralAmount.eq(liquidatorBalanceAfter.sub(liquidatorBalanceBefore))).to.be.true
      expect(vaultBefore.shortAmount.sub(vaultAfter.shortAmount).eq(liquidatorSqueethBefore.sub(liquidatorSqueethAfter))).to.be.true
    })

    it("fully liquidate vault 2, get expected payout", async () => {      
      const vaultBefore = await controller.vaults(vault2Id)
      
      // state before liquidation
      const liquidatorSqueethBefore = await squeeth.balanceOf(liquidator.address)
      const liquidatorBalanceBefore = await provider.getBalance(liquidator.address)

      // liquidate the full vault
      const wSqueethAmountToLiquidate = vaultBefore.shortAmount

      const result = await liquidationHelper.checkLiquidation(vault2Id);
      const isUnsafe = result[0]
      const isLiquidatableAfterReducingDebt = result[1]
      const minWPowerPerpAmount = result[2]
      const collateralToReceive = result[3]

      await controller.connect(liquidator).liquidate(vault2Id, wSqueethAmountToLiquidate);
      const vaultAfter = await controller.vaults(vault2Id)
      const liquidatorBalanceAfter = await provider.getBalance(liquidator.address)
      const liquidatorSqueethAfter = await squeeth.balanceOf(liquidator.address)

      const newSqueethPrice = await oracle.getTwap(squeethPool.address, squeeth.address, weth.address, 600, false)
      const collateralToGet = newSqueethPrice.mul(wSqueethAmountToLiquidate).div(one).mul(11).div(10)
      
      expect(isUnsafe).to.be.true
      expect(isLiquidatableAfterReducingDebt).to.be.true
      expect(minWPowerPerpAmount.eq(vaultBefore.shortAmount)).to.be.true
      expect(isSimilar(collateralToReceive.toString(), (collateralToGet).toString())).to.be.true

      // expect(collateralToGet.eq(liquidatorBalanceAfter.sub(liquidatorBalanceBefore))).to.be.true
      expect(vaultBefore.shortAmount.sub(vaultAfter.shortAmount).eq(liquidatorSqueethBefore.sub(liquidatorSqueethAfter))).to.be.true
      expect(vaultAfter.shortAmount.isZero()).to.be.true
      expect(vaultAfter.collateralAmount.gt(0)).to.be.true
    })
    
    it('should revert when trying to liquidate vault 6 (nft vault underwater) but leave dust behind', async() => {
      const vaultBefore = await controller.vaults(vault6Id)
      const wSqueethAmountToLiquidate = vaultBefore.shortAmount.sub(1)

      const result = await liquidationHelper.checkLiquidation(vault6Id);
      const [isUnsafe, isLiquidatableAfterReducingDebt, maxWPowerPerpAmount] = result;

      expect(isUnsafe).to.be.true
      expect(isLiquidatableAfterReducingDebt).to.be.true
      expect(maxWPowerPerpAmount.eq((vaultBefore.shortAmount))).to.be.true

      await expect(controller.connect(liquidator).liquidate(vault6Id, wSqueethAmountToLiquidate)).to.be.revertedWith('C22');
    })

    it("fully liquidate vault 6, redeem nft and liquidate", async () => {
      const vaultBefore = await controller.vaults(vault6Id)
      
      // state before liquidation
      const liquidatorSqueethBefore = await squeeth.balanceOf(liquidator.address)
      const liquidatorBalanceBefore = await provider.getBalance(liquidator.address)

      // liquidate the full vault
      const wSqueethAmountToLiquidate = vaultBefore.shortAmount

      const result = await liquidationHelper.checkLiquidation(vault6Id);
      const [isUnsafe, isLiquidatableAfterReducingDebt, maxWPowerPerpAmount, collateralToReceive] = result;

      await controller.connect(liquidator).liquidate(vault6Id, wSqueethAmountToLiquidate);
      const vaultAfter = await controller.vaults(vault6Id)
      const liquidatorBalanceAfter = await provider.getBalance(liquidator.address)
      const liquidatorSqueethAfter = await squeeth.balanceOf(liquidator.address)

      const newSqueethPrice = await oracle.getTwap(squeethPool.address, squeeth.address, weth.address, 600, false)
      const collateralToGet = newSqueethPrice.mul(wSqueethAmountToLiquidate).div(one).mul(11).div(10)
      
      expect(isUnsafe).to.be.true
      expect(isLiquidatableAfterReducingDebt).to.be.true
      expect(maxWPowerPerpAmount.eq((vaultBefore.shortAmount))).to.be.true
      expect(isSimilar(collateralToReceive.toString(), (collateralToGet).toString())).to.be.true

      // expect(collateralToGet.eq(liquidatorBalanceAfter.sub(liquidatorBalanceBefore))).to.be.true
      expect(vaultBefore.shortAmount.sub(vaultAfter.shortAmount).eq(liquidatorSqueethBefore.sub(liquidatorSqueethAfter))).to.be.true
      expect(vaultAfter.shortAmount.isZero()).to.be.true
      expect(vaultAfter.collateralAmount.gt(0)).to.be.true
    })

    it("should revert when trying to liquidate a safe vault", async () => {
      const vaultBefore = await controller.vaults(vault3Id)
      const wSqueethAmountToLiquidate = vaultBefore.shortAmount.div(2)

      const result = await liquidationHelper.checkLiquidation(vault6Id);
      const [isUnsafe, isLiquidatableAfterReducingDebt, maxWPowerPerpAmount, collateralToReceive] = result;

      expect(isUnsafe).to.be.false
      expect(isLiquidatableAfterReducingDebt).to.be.false
      expect(maxWPowerPerpAmount.eq(BigNumber.from(0))).to.be.true
      expect(collateralToReceive.eq(BigNumber.from(0))).to.be.true
      
      await expect(controller.connect(liquidator).liquidate(vault3Id, wSqueethAmountToLiquidate)).to.be.revertedWith('C12')
    })
  })

  describe('Save vault with uni nft when price is 4x', async( )=> {
    before('push squeeth price higher 2x', async() => {
      // set squeeth price higher by buying half of squeeth in the pool
      const poolSqueethBalance = await squeeth.balanceOf(squeethPool.address)

      const maxWeth = poolSqueethBalance.mul(scaledStartingSqueethPrice1e18).mul(5).div(one)
      
      // how much squeeth to buy to make the price 2x
      const newPoolSqueethBalance = new BigNumberJs(poolSqueethBalance.toString()).div(Math.SQRT2).integerValue().toString()
      const squeethToBuy = poolSqueethBalance.sub(newPoolSqueethBalance)
      
      const exactOutputParam = {
        tokenIn: weth.address,
        tokenOut: squeeth.address,
        fee: 3000,
        recipient: liquidityProvider.address,
        deadline: await getNow(provider) + 86400,
        amountOut: squeethToBuy,
        amountInMaximum: maxWeth,
        sqrtPriceLimitX96: 0,
      }

      await weth.connect(liquidityProvider).deposit({value: maxWeth})
      await weth.connect(liquidityProvider).approve(swapRouter.address, ethers.constants.MaxUint256)      
      await (swapRouter as ISwapRouter).connect(liquidityProvider).exactOutputSingle(exactOutputParam)

      // make sure price is set correctly
      await provider.send("evm_increaseTime", [10]) // increase time by 10 sec
      await provider.send("evm_mine", [])
      const newSqueethPrice = await oracle.getTwap(squeethPool.address, squeeth.address, weth.address, 1, false)
      expect(isSimilar(newSqueethPrice.toString(), scaledStartingSqueethPrice1e18.mul(4).toString())).to.be.true

    })
    before('push weth price higher 2x', async() => {
      // set weth price higher by buying half of weth in the pool
      const poolWethBalance = await weth.balanceOf(ethDaiPool.address)

      const maxDai = poolWethBalance.mul(startingEthPrice).mul(5)

      const newPoolBalance = new BigNumberJs(poolWethBalance.toString()).div(Math.SQRT2).integerValue().toString()
      const amountWethToBuy = poolWethBalance.sub(newPoolBalance)

      const exactOutputParam = {
        tokenIn: dai.address,
        tokenOut: weth.address,
        fee: 3000,
        recipient: liquidityProvider.address,
        deadline: await getNow(provider) + 86400,
        amountOut: amountWethToBuy,
        amountInMaximum: maxDai,
        sqrtPriceLimitX96: 0,
      }

      await dai.connect(liquidityProvider).mint(liquidityProvider.address, maxDai, )
      await dai.connect(liquidityProvider).approve(swapRouter.address, ethers.constants.MaxUint256)      
      await (swapRouter as ISwapRouter).connect(liquidityProvider).exactOutputSingle(exactOutputParam)

      // make sure price is set correctly
      await provider.send("evm_increaseTime", [10]) // increase time by 10 sec
      await provider.send("evm_mine", [])
      const newWethPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 1, false)
      expect(isSimilar(newWethPrice.toString(), startingEthPrice1e18.mul(4).toString())).to.be.true
    })
    before('increase block time to make sure TWAP is updated', async() => {
      await provider.send("evm_increaseTime", [3600]) // increase time by 60 mins
      await provider.send("evm_mine", [])

      const newEthPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 3600, false)
      const newSqueethPrice = await oracle.getTwap(squeethPool.address, squeeth.address, weth.address, 3600, false)
      expect(isSimilar(newEthPrice.toString(), newSqueethPrice.mul(oracleScaleFactor).toString(), 3)).to.be.true
    })
    it("calling liquidation now will save vault 3 and get bounty", async () => {
      const newSqueethPrice = await oracle.getTwap(squeethPool.address, squeeth.address, weth.address, 600, false)
      // price has 4x, eth amount should have doubled in the nft
      // squeeth amount should be cut in half
      // get net worth of nft
      const { tick } = await (squeethPool as IUniswapV3Pool).slot0()
      const isWethToken0 = parseInt(weth.address, 16) < parseInt(squeeth.address, 16)
      const { ethAmount, wPowerPerpAmount } = await vaultLib.getUniPositionBalances(positionManager.address, vault3LPTokenId, tick, isWethToken0)
      
      const vaultBefore = await controller.vaults(vault3Id)
      const wSqueethAmountToLiquidate = vaultBefore.shortAmount.sub(wPowerPerpAmount).div(2)
      const liquidatorEthBalance = await provider.getBalance(liquidator.address)

      const result = await liquidationHelper.checkLiquidation(vault3Id);
      const [isUnsafe, isLiquidatableAfterReducingDebt, maxWPowerPerpAmount, collateralToReceive] = result;

      // hack: increase liquidity so the fee info got updated
      await positionManager.connect(liquidityProvider).increaseLiquidity({
        tokenId: vault3LPTokenId,
        amount0Desired: 10000,
        amount1Desired: 10000,
        amount0Min: 1,
        amount1Min: 1,
        deadline: (await getNow(provider)) + 1000
      })
      const { tokensOwed0, tokensOwed1 }  = await positionManager.positions(vault3LPTokenId)
      const ethFeeAmount = isWethToken0 ? tokensOwed0 : tokensOwed1
      const squeethFeeAmount = isWethToken0 ? tokensOwed1 : tokensOwed0

      const totalEthFromUniPosition = ethAmount.add(ethFeeAmount)
      const totalWSqueethFromUniPosition = wPowerPerpAmount.add(squeethFeeAmount)

      await controller.connect(liquidator).liquidate(vault3Id, wSqueethAmountToLiquidate)

      const liquidatorEthAfter = await provider.getBalance(liquidator.address)
      const vaultAfter = await controller.vaults(vault3Id)
      
      // paying a 2% bounty on top of total value withdrawn from NFT.
      const withdrawWSqueethInEth = newSqueethPrice.mul(totalWSqueethFromUniPosition).div(one)
      const bounty = withdrawWSqueethInEth.add(totalEthFromUniPosition).mul(2).div(100);
      
      expect(isUnsafe).to.be.true
      expect(isLiquidatableAfterReducingDebt).to.be.false
      expect(maxWPowerPerpAmount.eq(BigNumber.from(0))).to.be.true

      expect(isSimilar(collateralToReceive.toString(), (bounty).toString(), 3)).to.be.true

      // expect(isSimilar(liquidatorEthAfter.sub(liquidatorEthBalance).toString(), bounty.toString())).to.be.true      
      expect(vaultAfter.NftCollateralId === 0).to.be.true

      expect(isSimilar(vaultBefore.collateralAmount.add(totalEthFromUniPosition).sub(bounty).toString(), vaultAfter.collateralAmount.toString(), 2)).to.be.true

      // the debt in the vault is reduced by squeethAmount.
      expect(isSimilar(vaultBefore.shortAmount.sub(vaultAfter.shortAmount).toString(), totalWSqueethFromUniPosition.toString())).to.be.true
    })

    it("seller4 can save his own vault", async () => {
      // increase time to make sure time since last update > 0, so view function won't revert
      await provider.send("evm_increaseTime", [10])
      await provider.send("evm_mine", [])

      expect(await controller.isVaultSafe(vault4Id)).to.be.false
      await controller.connect(seller4).reduceDebt(vault4Id)

      // increase time to make sure time since last update > 0, so view function won't revert
      await provider.send("evm_increaseTime", [10])
      await provider.send("evm_mine", [])
      const vaultAfter = await controller.vaults(vault4Id)
      expect(vaultAfter.NftCollateralId === 0).to.be.true
      expect(await controller.isVaultSafe(vault4Id)).to.be.true
    })
  })

  describe('Liquidate vault with uni nft when price is 8x', async( )=> {
    before('push squeeth price higher 2x', async() => {
      // set squeeth price higher by buying half of squeeth in the pool
      const poolSqueethBalance = await squeeth.balanceOf(squeethPool.address)
      const poolWethBalance = await weth.balanceOf(squeethPool.address)

      // calculate max weth with 1.5x buffer
      const maxWeth = new BigNumberJs(poolWethBalance.toString()).times(Math.SQRT2 - 1).times(2).integerValue().toString()

      // how much squeeth to buy to make the price 2x
      const newPoolSqueethBalance = new BigNumberJs(poolSqueethBalance.toString()).div(Math.SQRT2).integerValue().toString()
      const squeethToBuy = poolSqueethBalance.sub(newPoolSqueethBalance)
      
      const exactOutputParam = {
        tokenIn: weth.address,
        tokenOut: squeeth.address,
        fee: 3000,
        recipient: liquidityProvider.address,
        deadline: await getNow(provider) + 86400,
        amountOut: squeethToBuy,
        amountInMaximum: maxWeth,
        sqrtPriceLimitX96: 0,
      }

      await weth.connect(liquidityProvider).deposit({value: maxWeth})
      await weth.connect(liquidityProvider).approve(swapRouter.address, ethers.constants.MaxUint256)      
      await (swapRouter as ISwapRouter).connect(liquidityProvider).exactOutputSingle(exactOutputParam)

      // make sure price is set correctly
      await provider.send("evm_increaseTime", [10]) // increase time by 10 sec
      await provider.send("evm_mine", [])
      const newSqueethPrice = await oracle.getTwap(squeethPool.address, squeeth.address, weth.address, 1, false)
      expect(isSimilar(newSqueethPrice.toString(), scaledStartingSqueethPrice1e18.mul(8).toString())).to.be.true

    })
    before('push weth price higher 2x', async() => {
      // set weth price higher by buying half of weth in the pool
      const poolWethBalance = await weth.balanceOf(ethDaiPool.address)
      const poolDaiBalance = await dai.balanceOf(ethDaiPool.address)
      
      // calculate max dai to spend with 1.5x buffer
      const maxDai = new BigNumberJs(poolDaiBalance.toString()).times(Math.SQRT2 - 1).times(1.5).integerValue().toString()

      const newPoolBalance = new BigNumberJs(poolWethBalance.toString()).div(Math.SQRT2).integerValue().toString()
      const amountWethToBuy = poolWethBalance.sub(newPoolBalance)

      const exactOutputParam = {
        tokenIn: dai.address,
        tokenOut: weth.address,
        fee: 3000,
        recipient: liquidityProvider.address,
        deadline: await getNow(provider) + 86400,
        amountOut: amountWethToBuy,
        amountInMaximum: maxDai,
        sqrtPriceLimitX96: 0,
      }

      await dai.connect(liquidityProvider).mint(liquidityProvider.address, maxDai, )
      await dai.connect(liquidityProvider).approve(swapRouter.address, ethers.constants.MaxUint256)      
      await (swapRouter as ISwapRouter).connect(liquidityProvider).exactOutputSingle(exactOutputParam)

      // make sure price is set correctly
      await provider.send("evm_increaseTime", [10]) // increase time by 10 sec
      await provider.send("evm_mine", [])
      const newWethPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 1, false)
      expect(isSimilar(newWethPrice.toString(), startingEthPrice1e18.mul(8).toString())).to.be.true
    })
    before('increase block time to make sure TWAP is updated', async() => {
      await provider.send("evm_increaseTime", [3600]) // increase time by 60 mins
      await provider.send("evm_mine", [])

      const newEthPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 3600, false)
      const newSqueethPrice = await oracle.getTwap(squeethPool.address, squeeth.address, weth.address, 3600, false)
      expect(isSimilar(newEthPrice.toString(), newSqueethPrice.mul(oracleScaleFactor).toString(), 3)).to.be.true
    })
    it("calling liquidation now will save vault5 + liquidate half of the remaining debt", async () => {
      const newSqueethPrice = await oracle.getTwap(squeethPool.address, squeeth.address, weth.address, 600, false)

      const { tick } = await (squeethPool as IUniswapV3Pool).slot0()
      const isWethToken0 = parseInt(weth.address, 16) < parseInt(squeeth.address, 16)
      const { ethAmount, wPowerPerpAmount } = await vaultLib.getUniPositionBalances(positionManager.address, vault5LPTokenId, tick, isWethToken0)
      
      // hack: increase liquidity so the fee info got updated
      await positionManager.connect(liquidityProvider).increaseLiquidity({
        tokenId: vault5LPTokenId,
        amount0Desired: 10000,
        amount1Desired: 10000,
        amount0Min: 1,
        amount1Min: 1,
        deadline: (await getNow(provider)) + 1000
      })
      const { tokensOwed0, tokensOwed1 }  = await positionManager.positions(vault5LPTokenId)
      const ethFeeAmount = isWethToken0 ? tokensOwed0 : tokensOwed1
      const squeethFeeAmount = isWethToken0 ? tokensOwed1 : tokensOwed0

      // total amount of eth and wsqueeth we can get out of the position nft
      const totalEthFromUniPosition = ethAmount.add(ethFeeAmount)
      const totalWSqueethFromUniPosition = wPowerPerpAmount.add(squeethFeeAmount)

      const vaultBefore = await controller.vaults(vault5Id)
      const wSqueethAmountToLiquidate = vaultBefore.shortAmount.sub(totalWSqueethFromUniPosition).div(2)
      const liquidatorEthBalance = await provider.getBalance(liquidator.address)

      const result = await liquidationHelper.checkLiquidation(vault5Id);
      const [isUnsafe, isLiquidatableAfterReducingDebt, maxWPowerPerpAmount, collateralToReceive] = result;

      await controller.connect(liquidator).liquidate(vault5Id, wSqueethAmountToLiquidate)

      const liquidatorEthAfter = await provider.getBalance(liquidator.address)
      const vaultAfter = await controller.vaults(vault5Id)
      
      const reward = newSqueethPrice.mul(wSqueethAmountToLiquidate).div(one).mul(11).div(10)

      expect(isUnsafe).to.be.true
      expect(isLiquidatableAfterReducingDebt).to.be.true

      // the estimation is not exactly the same but only off by a very small amount.
      expect(isSimilar(maxWPowerPerpAmount.toString(), wSqueethAmountToLiquidate.toString(), 10)).to.be.true
      expect(isSimilar(collateralToReceive.toString(), reward.toString(), 3)).to.be.true

      expect(isSimilar(liquidatorEthAfter.sub(liquidatorEthBalance).toString(), reward.toString())).to.be.true      
      expect(vaultAfter.NftCollateralId === 0).to.be.true

      expect(isSimilar(vaultBefore.collateralAmount.add(totalEthFromUniPosition).sub(reward).toString(), vaultAfter.collateralAmount.toString())).to.be.true

      // the debt in the vault is reduced by squeethAmount.
      expect(isSimilar(vaultBefore.shortAmount.sub(vaultAfter.shortAmount).toString(), totalWSqueethFromUniPosition.add(wSqueethAmountToLiquidate).toString())).to.be.true
    })
  })
  
})
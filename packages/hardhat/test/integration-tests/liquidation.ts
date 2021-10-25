import { ethers } from "hardhat"
import BigNumberJs from 'bignumber.js'
import { Contract, BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { expect } from "chai";
import { Controller, INonfungiblePositionManager, ISwapRouter, IUniswapV3Pool, MockErc20, Oracle, VaultLibTester, ShortPowerPerp, WETH9, WPowerPerp } from "../../typechain";
import { deployUniswapV3, deploySqueethCoreContracts, deployWETHAndDai, addSqueethLiquidity, addWethDaiLiquidity } from '../setup'
import { isSimilar, getNow, one, oracleScaleFactor } from "../utils";

// make sure .toString won't return string like 3.73e+22
BigNumberJs.set({EXPONENTIAL_AT: 30})

describe("Liquidation Integration Test", function () {
  let oracle: Oracle;
  let dai: MockErc20
  let weth: WETH9
  let squeeth: WPowerPerp
  let shortSqueeth: ShortPowerPerp
  let positionManager: Contract
  let controller: Controller
  let swapRouter: Contract

  const provider = ethers.provider
  let squeethPool: Contract
  let ethDaiPool: Contract

  let vaultLib: VaultLibTester

  const startingEthPrice = 3000
  const startingEthPrice1e18 = BigNumber.from(startingEthPrice).mul(one) // 3000 * 1e18

  const scaledStartingSqueethPrice1e18 = startingEthPrice1e18.div(oracleScaleFactor) // 0.3 * 1e18
  
  const scaledStartingSqueethPrice = startingEthPrice / oracleScaleFactor.toNumber() // 0.3
  

  // const provider = ethers.provider
  let liquidityProvider: SignerWithAddress
  let seller1: SignerWithAddress
  let seller2: SignerWithAddress
  let seller3: SignerWithAddress
  let liquidator: SignerWithAddress

  const humanReadableMintAmount = '100'

  let vault0Id: BigNumber
  let vault1Id: BigNumber
  let vault2Id: BigNumber

  let vault1LPTokenId: number
  let vault2LPTokenId: number

  this.beforeAll("Prepare accounts", async() => {
    const accounts = await ethers.getSigners()
    liquidityProvider = accounts[0]
    seller1 = accounts[1]
    seller2 = accounts[2]
    seller3 = accounts[3]
    liquidator = accounts[4]
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

    positionManager = uniDeployments.positionManager
    swapRouter = uniDeployments.swapRouter

    squeeth = coreDeployments.wsqueeth
    shortSqueeth = coreDeployments.shortSqueeth
    controller = coreDeployments.controller
    squeethPool = coreDeployments.wsqueethEthPool
    ethDaiPool = coreDeployments.ethDaiPool
    oracle = coreDeployments.oracle

    const VaultTester = await ethers.getContractFactory("VaultLibTester");
    vaultLib = (await VaultTester.deploy()) as VaultLibTester;
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

    const depositAmount = ethers.utils.parseUnits('45.1')
    const mintAmount = ethers.utils.parseUnits(humanReadableMintAmount)
    await controller.connect(seller1).mintPowerPerpAmount(0, mintAmount, 0, {value: depositAmount})
  })

  this.beforeAll('Prepare vault1 (with nft), dealing with cases when\'s safe after saving', async() => {
    vault1Id = await shortSqueeth.nextId()

    const depositAmount = ethers.utils.parseUnits('45.1')
    const mintAmount = ethers.utils.parseUnits(humanReadableMintAmount)
    await controller.connect(seller2).mintPowerPerpAmount(0, mintAmount, 0, {value: depositAmount})

    vault1LPTokenId = await addSqueethLiquidity(
      scaledStartingSqueethPrice,
      humanReadableMintAmount,
      '45.1',
      liquidityProvider.address,
      squeeth,
      weth,
      positionManager,
      controller
    )
    await (positionManager as INonfungiblePositionManager).connect(liquidityProvider).transferFrom(liquidityProvider.address, seller2.address, vault1LPTokenId)
    await (positionManager as INonfungiblePositionManager).connect(seller2).approve(controller.address, vault1LPTokenId)

    await controller.connect(seller2).depositUniPositionToken(vault1Id, vault1LPTokenId)
    const vault = await controller.vaults(vault1Id)
    expect(vault.NftCollateralId === vault1LPTokenId).to.be.true
  })

  this.beforeAll('Prepare vault2 (with nft), for liquidation', async() => {
    vault2Id = await shortSqueeth.nextId()

    const depositAmount = ethers.utils.parseUnits('45.1')
    const mintAmount = ethers.utils.parseUnits(humanReadableMintAmount)
    await controller.connect(seller2).mintPowerPerpAmount(0, mintAmount, 0, {value: depositAmount})

    vault2LPTokenId = await addSqueethLiquidity(
      scaledStartingSqueethPrice,
      humanReadableMintAmount,
      '45.1',
      liquidityProvider.address,
      squeeth,
      weth,
      positionManager,
      controller
    )
    await (positionManager as INonfungiblePositionManager).connect(liquidityProvider).transferFrom(liquidityProvider.address, seller3.address, vault2LPTokenId)
    await (positionManager as INonfungiblePositionManager).connect(seller3).approve(controller.address, vault2LPTokenId)

    await controller.connect(seller3).depositUniPositionToken(vault2Id, vault2LPTokenId)
    const vault = await controller.vaults(vault2Id)
    expect(vault.NftCollateralId === vault2LPTokenId).to.be.true
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
      const newSqueethPrice = await oracle.getTwap(squeethPool.address, squeeth.address, weth.address, 1)
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
      const newWethPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 1)
      expect(isSimilar(newWethPrice.toString(), startingEthPrice1e18.mul(2).toString())).to.be.true
    })
    before('increase block time to make sure TWAP is updated', async() => {
      await provider.send("evm_increaseTime", [3600]) // increase time by 60 mins
      await provider.send("evm_mine", [])

      const newEthPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 3600)
      const newSqueethPrice = await oracle.getTwap(squeethPool.address, squeeth.address, weth.address, 3600)
      expect(isSimilar(newEthPrice.toString(), newSqueethPrice.mul(oracleScaleFactor).toString(), 3)).to.be.true
    })

    before('prepare liquidator to liquidate vault 0', async() => {
      const newEthPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 600)
      const vaultBefore = await controller.vaults(vault0Id)
      
      const mintAmount = vaultBefore.shortAmount
      const collateralRequired = mintAmount.mul(newEthPrice).mul(2).div(oracleScaleFactor).div(one)

      // mint squeeth to liquidate vault0!
      await controller.connect(liquidator).mintPowerPerpAmount(0, mintAmount, 0, {value: collateralRequired})
      
    })
    
    it("liquidate vault 0", async () => {

      const newEthPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 600)
      const vaultBefore = await controller.vaults(vault0Id)
      
      // state before liquidation
      const liquidatorSqueethBefore = await squeeth.balanceOf(liquidator.address)
      const liquidatorBalanceBefore = await provider.getBalance(liquidator.address)

      const wSqueethAmountToLiquidate = vaultBefore.shortAmount.div(2)

      await controller.connect(liquidator).liquidate(vault0Id, wSqueethAmountToLiquidate, {gasPrice: 0});
      
      const normFactor = await controller.normalizationFactor()
      const collateralToGet = newEthPrice.div(oracleScaleFactor).mul(normFactor).mul(wSqueethAmountToLiquidate).div(one).div(one).mul(11).div(10)

      const vaultAfter = await controller.vaults(vault0Id)
      const liquidatorBalanceAfter = await provider.getBalance(liquidator.address)
      const liquidatorSqueethAfter = await squeeth.balanceOf(liquidator.address)
      
      expect(collateralToGet.eq(liquidatorBalanceAfter.sub(liquidatorBalanceBefore))).to.be.true
      expect(vaultBefore.shortAmount.sub(vaultAfter.shortAmount).eq(liquidatorSqueethBefore.sub(liquidatorSqueethAfter))).to.be.true
    })

    it("should revert when trying to liquidate a safe vault", async () => {
      const vaultBefore = await controller.vaults(vault1Id)
      const wSqueethAmountToLiquidate = vaultBefore.shortAmount.div(2)
      await expect(controller.connect(liquidator).liquidate(vault1Id, wSqueethAmountToLiquidate, {gasPrice: 0})).to.be.revertedWith('Can not liquidate safe vault')
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
      const newSqueethPrice = await oracle.getTwap(squeethPool.address, squeeth.address, weth.address, 1)
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
      const newWethPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 1)
      expect(isSimilar(newWethPrice.toString(), startingEthPrice1e18.mul(4).toString())).to.be.true
    })
    before('increase block time to make sure TWAP is updated', async() => {
      await provider.send("evm_increaseTime", [3600]) // increase time by 60 mins
      await provider.send("evm_mine", [])

      const newEthPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 3600)
      const newSqueethPrice = await oracle.getTwap(squeethPool.address, squeeth.address, weth.address, 3600)
      expect(isSimilar(newEthPrice.toString(), newSqueethPrice.mul(oracleScaleFactor).toString(), 3)).to.be.true
    })
    it("calling liquidation now will save vault 1 and get bounty", async () => {
      const newEthPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 600)
      // price has 4x, eth amount should have doubled in the nft
      // squeeth amount should be cut in half
      // get net worth of nft
      const { tick } = await (squeethPool as IUniswapV3Pool).slot0()
      const isWethToken0 = parseInt(weth.address, 16) < parseInt(squeeth.address, 16)
      const { ethAmount, squeethAmount } = await vaultLib.getUniPositionBalances(positionManager.address, vault1LPTokenId, tick, isWethToken0)
      
      const vaultBefore = await controller.vaults(vault1Id)
      const wSqueethAmountToLiquidate = vaultBefore.shortAmount.sub(squeethAmount).div(2)
      const liquidatorEthBalance = await provider.getBalance(liquidator.address)

      await controller.connect(liquidator).liquidate(vault1Id, wSqueethAmountToLiquidate, {gasPrice: 0})

      const liquidatorEthAfter = await provider.getBalance(liquidator.address)
      const vaultAfter = await controller.vaults(vault1Id)
      const normFactor = await controller.normalizationFactor()
      
      // paying a 2% bounty on top of total value withdrawn from NFT.
      const withdrawWSqueethInEth = newEthPrice.mul(normFactor).mul(squeethAmount).div(one).div(one).div(oracleScaleFactor)
      const bounty = withdrawWSqueethInEth.add(ethAmount).mul(2).div(100);
      
      expect(isSimilar(liquidatorEthAfter.sub(liquidatorEthBalance).toString(), bounty.toString())).to.be.true      
      expect(vaultAfter.NftCollateralId === 0).to.be.true
      expect(isSimilar(vaultBefore.collateralAmount.add(ethAmount).sub(bounty).toString(), vaultAfter.collateralAmount.toString())).to.be.true

      // the debt in the vault is reduced by squeethAmount.
      expect(isSimilar(vaultBefore.shortAmount.sub(vaultAfter.shortAmount).toString(), squeethAmount.toString())).to.be.true
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
      const newSqueethPrice = await oracle.getTwap(squeethPool.address, squeeth.address, weth.address, 1)
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
      const newWethPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 1)
      expect(isSimilar(newWethPrice.toString(), startingEthPrice1e18.mul(8).toString())).to.be.true
    })
    before('increase block time to make sure TWAP is updated', async() => {
      await provider.send("evm_increaseTime", [3600]) // increase time by 60 mins
      await provider.send("evm_mine", [])

      const newEthPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 3600)
      const newSqueethPrice = await oracle.getTwap(squeethPool.address, squeeth.address, weth.address, 3600)
      expect(isSimilar(newEthPrice.toString(), newSqueethPrice.mul(oracleScaleFactor).toString(), 3)).to.be.true
    })
    it("calling liquidation now will save vault2 + liquidate half of the remaining debt", async () => {
      const newEthPrice = await oracle.getTwap(ethDaiPool.address, weth.address, dai.address, 600)
      const { tick } = await (squeethPool as IUniswapV3Pool).slot0()
      const isWethToken0 = parseInt(weth.address, 16) < parseInt(squeeth.address, 16)
      const { ethAmount, squeethAmount } = await vaultLib.getUniPositionBalances(positionManager.address, vault2LPTokenId, tick, isWethToken0)
      
      const vaultBefore = await controller.vaults(vault2Id)
      const wSqueethAmountToLiquidate = vaultBefore.shortAmount.sub(squeethAmount).div(2)
      const liquidatorEthBalance = await provider.getBalance(liquidator.address)

      await controller.connect(liquidator).liquidate(vault2Id, wSqueethAmountToLiquidate, {gasPrice: 0})

      const liquidatorEthAfter = await provider.getBalance(liquidator.address)
      const vaultAfter = await controller.vaults(vault2Id)
      const normFactor = await controller.normalizationFactor()
      
      const reward = newEthPrice.div(oracleScaleFactor).mul(normFactor).mul(wSqueethAmountToLiquidate).div(BigNumber.from(10).pow(36)).mul(11).div(10)

      expect(isSimilar(liquidatorEthAfter.sub(liquidatorEthBalance).toString(), reward.toString())).to.be.true      
      expect(vaultAfter.NftCollateralId === 0).to.be.true
      expect(isSimilar(vaultBefore.collateralAmount.add(ethAmount).sub(reward).toString(), vaultAfter.collateralAmount.toString())).to.be.true

      // the debt in the vault is reduced by squeethAmount.
      expect(isSimilar(vaultBefore.shortAmount.sub(vaultAfter.shortAmount).toString(), squeethAmount.add(wSqueethAmountToLiquidate).toString())).to.be.true
    })
  })
  
})

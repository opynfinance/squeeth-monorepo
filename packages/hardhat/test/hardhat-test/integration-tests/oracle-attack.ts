import { ethers } from "hardhat"
import BigNumberJs from 'bignumber.js'
import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { Controller, INonfungiblePositionManager, MockErc20, ShortPowerPerp, WETH9, WPowerPerp, IUniswapV3Pool, ISwapRouter } from "../../../typechain";
import { deployUniswapV3, deploySqueethCoreContracts, deployWETHAndDai, addSqueethLiquidity, addWethDaiLiquidity } from '../setup'
import { isSimilar, getNow, one, oracleScaleFactor } from "../utils";

BigNumberJs.set({EXPONENTIAL_AT: 30})

describe("Testing system stability during extreme market conditions", function () {
  const provider = ethers.provider

  let dai: MockErc20
  let weth: WETH9
  let wsqueeth: WPowerPerp
  let shortSqueeth: ShortPowerPerp
  let positionManager: INonfungiblePositionManager
  let controller: Controller
  
  let wethPool: IUniswapV3Pool
  let swapRouter: ISwapRouter
  
  
  const startingEthPrice = 3000
  
  const scaledStartingSqueethPrice = startingEthPrice / oracleScaleFactor.toNumber() // 0.3
  
  let liquidityProvider: SignerWithAddress
  let seller: SignerWithAddress
  let attacker: SignerWithAddress

  const humanReadableMintAmount = '100'

  const collateralRatio = 2
  const mintAmount = ethers.utils.parseUnits(humanReadableMintAmount)
  const depositAmount = mintAmount.mul(startingEthPrice).mul(collateralRatio).div(oracleScaleFactor)
  
  const minCollatRatio1e18 = one.mul(3).div(2)
  const minCollateral = mintAmount.mul(startingEthPrice).mul(minCollatRatio1e18).div(oracleScaleFactor).div(one)
  
  let vault0Id: BigNumber

  this.beforeAll("Prepare accounts", async() => {
    const accounts = await ethers.getSigners()
    liquidityProvider = accounts[0]
    seller = accounts[1]
    attacker = accounts[8]
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

    wsqueeth = coreDeployments.wsqueeth
    shortSqueeth = coreDeployments.shortSqueeth
    controller = coreDeployments.controller
    
    wethPool = coreDeployments.ethDaiPool as IUniswapV3Pool
    swapRouter = uniDeployments.swapRouter as ISwapRouter
  })

  this.beforeAll('Add liquidity to both pools', async() => {
    await addSqueethLiquidity(
      scaledStartingSqueethPrice, 
      '5',
      '30', 
      liquidityProvider.address, 
      wsqueeth, 
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

    // increase time by 10 minutes to make sure we have at least 300 seconds of history
    await provider.send("evm_increaseTime", [600])
    await provider.send("evm_mine", [])
  })

  this.beforeAll('Prepare vault with collateral ratio = 2.', async() => {
    vault0Id = await shortSqueeth.nextId()

    await controller.connect(seller).mintPowerPerpAmount(0, mintAmount, 0, {value: depositAmount})
  })

  describe('Scenario: ETH/DAI price spikes 100%', async( )=> {
    // an attacker may push the eth/dai price up to liquidate other's vaults
    // this is a simulation of how much the TWAP can resist this kind of attack

    before('set eth price to 2x', async() => {
      
      // set weth price higher by buying weth from the pool
      const poolWethBalance = await weth.balanceOf(wethPool.address)
      const poolDaiBalance = await dai.balanceOf(wethPool.address)

      // calculate max weth with 1.5x buffer
      const maxDai = new BigNumberJs(poolDaiBalance.toString()).times(Math.SQRT2 - 1).times(2).integerValue().toString()

      // how much squeeth to buy to make the price 2x
      const newPoolWethBalance = new BigNumberJs(poolWethBalance.toString()).div(Math.SQRT2).integerValue().toString()
      const wethToBuy = poolWethBalance.sub(newPoolWethBalance)
      
      const exactOutputParam = {
        tokenIn: dai.address,
        tokenOut: weth.address,
        fee: 3000,
        recipient: attacker.address,
        deadline: await getNow(provider) + 86400,
        amountOut: wethToBuy,
        amountInMaximum: maxDai,
        sqrtPriceLimitX96: 0,
      }

      await dai.connect(attacker).mint(attacker.address, maxDai)
      await dai.connect(attacker).approve(swapRouter.address, ethers.constants.MaxUint256)      
      await (swapRouter as ISwapRouter).connect(attacker).exactOutputSingle(exactOutputParam)

      await provider.send("evm_increaseTime", [1]) // increase time by 1 sec
      await provider.send("evm_mine", [])
    })

    describe('1 second after eth price spikes (similar to the state created by flashloan)', async() => {
      it('index price is updated if requesting with period 1', async() => {
        const newIndexPrice = await controller.getUnscaledIndex(1)
        const expectedIndex = BigNumber.from(startingEthPrice).mul(2).pow(2).mul(one)
        // index is about 6000^2
        expect(isSimilar(newIndexPrice.toString(), expectedIndex.toString(), 3)).to.be.true
      })
      it('vaults remains safe because of TWAP', async() => {
        const isSafeVault = await controller.isVaultSafe(vault0Id)
        expect(isSafeVault).to.be.true
      })
      it('can still mint with the same amount of collateral (because of TWAP)', async() => {
        await controller.connect(attacker).mintPowerPerpAmount(0, mintAmount, 0, {value: depositAmount})
      })
      it('should revert when trying to mint the same amount with smaller collateral', async() => {
        await expect(
          controller.connect(attacker).mintPowerPerpAmount(0, mintAmount, 0, {value: minCollateral})
        ).to.be.revertedWith('C24')
      })
    })

    describe('3 minutes after eth price spiked', async() => {
      before('increase time', async() => {
        await provider.send("evm_increaseTime", [180])
        await provider.send("evm_mine", [])
      })
      it('index price is updated if requesting with period 180', async() => {
        const newIndexPrice = await controller.getUnscaledIndex(180)
        const expectedIndex = BigNumber.from(startingEthPrice).mul(2).pow(2).mul(one)
        expect(isSimilar(newIndexPrice.toString(), expectedIndex.toString(), 3)).to.be.true
      })
      it('vaults becomes unsafe', async() => {
        const isSafeVault = await controller.isVaultSafe(vault0Id)
        expect(isSafeVault).to.be.false
      })
      it('should revert when trying to mint with same amount of collateral as before', async() => {
        await expect(
          controller.connect(attacker).mintPowerPerpAmount(0, mintAmount, 0, {value: depositAmount})
        ).to.be.revertedWith('C24')
      })
    })

    after('Push eth price back to normal', async() => {
      // set weth price back: set price of dai 2x
      // this is the same operation by reverse dai and weth
      const poolWethBalance = await weth.balanceOf(wethPool.address)
      const poolDaiBalance = await dai.balanceOf(wethPool.address)

      // calculate max weth with 1.5x buffer
      const maxWeth = new BigNumberJs(poolWethBalance.toString()).times(Math.SQRT2 - 1).times(2).integerValue().toString()

      // how much squeeth to buy to make the price 2x
      const newPoolDaiBalance = new BigNumberJs(poolDaiBalance.toString()).div(Math.SQRT2).integerValue().toString()
      const daiToBuy = poolDaiBalance.sub(newPoolDaiBalance)
      
      const exactOutputParam = {
        tokenIn: weth.address,
        tokenOut: dai.address,
        fee: 3000,
        recipient: attacker.address,
        deadline: await getNow(provider) + 86400,
        amountOut: daiToBuy,
        amountInMaximum: maxWeth,
        sqrtPriceLimitX96: 0,
      }

      await weth.connect(attacker).deposit({value: maxWeth})
      await weth.connect(attacker).approve(swapRouter.address, ethers.constants.MaxUint256)      
      await (swapRouter as ISwapRouter).connect(attacker).exactOutputSingle(exactOutputParam)

      await provider.send("evm_increaseTime", [600]) // increase time by 10 minutes
      await provider.send("evm_mine", [])
    })
  })

  describe('Scenario: ETH/DAI price crashes 50%', async( )=> {
    before('set eth price to 50%', async() => {
      
      // set weth price back: set price of dai 2x
      // this is the same operation by reverse dai and weth
      const poolWethBalance = await weth.balanceOf(wethPool.address)
      const poolDaiBalance = await dai.balanceOf(wethPool.address)

      // calculate max weth with 1.5x buffer
      const maxWeth = new BigNumberJs(poolWethBalance.toString()).times(Math.SQRT2 - 1).times(2).integerValue().toString()

      // how much squeeth to buy to make the price 2x
      const newPoolDaiBalance = new BigNumberJs(poolDaiBalance.toString()).div(Math.SQRT2).integerValue().toString()
      const daiToBuy = poolDaiBalance.sub(newPoolDaiBalance)
      
      const exactOutputParam = {
        tokenIn: weth.address,
        tokenOut: dai.address,
        fee: 3000,
        recipient: attacker.address,
        deadline: await getNow(provider) + 86400,
        amountOut: daiToBuy,
        amountInMaximum: maxWeth,
        sqrtPriceLimitX96: 0,
      }

      await weth.connect(attacker).deposit({value: maxWeth})
      await weth.connect(attacker).approve(swapRouter.address, ethers.constants.MaxUint256)      
      await (swapRouter as ISwapRouter).connect(attacker).exactOutputSingle(exactOutputParam)

      await provider.send("evm_increaseTime", [1]) // increase time by 1 sec
      await provider.send("evm_mine", [])
    })

    describe('1 second after eth price crash (Similar to the state created by flashloan)', async() => {
      it('index price is updated if requesting with period 1', async() => {
        const newIndexPrice = await controller.getUnscaledIndex(1)
        const expectedIndex = BigNumber.from(startingEthPrice).div(2).pow(2).mul(one)
        // index is about 1500^2
        expect(isSimilar(newIndexPrice.toString(), expectedIndex.toString(), 2)).to.be.true
      })
      it('vaults is still safe (because price moves down)', async() => {
        const isSafeVault = await controller.isVaultSafe(vault0Id)
        expect(isSafeVault).to.be.true
      })
      it('should revert if trying to mint more squeeth', async() => {
        // attack only put in the old min collateral
        const attackMintAmount = mintAmount.mul(101).div(100)
        
        await expect(
          controller.connect(attacker).mintPowerPerpAmount(0, attackMintAmount, 0, {value: minCollateral})
        ).to.be.revertedWith('C24')
      })
    })

    describe('1 minutes after eth price crashed', async() => {
      before('increase time', async() => {
        await provider.send("evm_increaseTime", [60])
        await provider.send("evm_mine", [])
      })
      it('index price is updated if requesting with period 60', async() => {
        const newIndexPrice = await controller.getUnscaledIndex(60)
        const expectedIndex = BigNumber.from(startingEthPrice).div(2).pow(2).mul(one)
        // index is about 1500^2
        expect(isSimilar(newIndexPrice.toString(), expectedIndex.toString(), 2)).to.be.true
      })
      
      it('will be able to mint more squeeth', async() => {
        // attack only put in the old min collateral
        const attackMintSuperHighAmount = mintAmount.mul(120).div(100)
        await expect(controller.connect(attacker).mintPowerPerpAmount(0, attackMintSuperHighAmount, 0, {value: minCollateral})).to.be.revertedWith('C24')

        const attackMintAmount = mintAmount.mul(110).div(100)
        await controller.connect(attacker).mintPowerPerpAmount(0, attackMintAmount, 0, {value: minCollateral})
      })
    })
    
  })
})

import { ethers } from "hardhat"
import { expect } from "chai";
import { parseEther } from "ethers/lib/utils";
import { BigNumber } from "ethers";
import { MockWSqueeth, MockUniswapV3Pool, MockErc20, MockUniPositionManager, VaultLibTester } from "../../typechain";
import { getSqrtPriceAndTickBySqueethPrice, getYAmountAboveRange, getXAmountBelowRange } from "../calculator";
import { isSimilar } from "../utils";


describe("VaultLib", function () {
  let squeeth: MockWSqueeth;
  let vaultLib: VaultLibTester
  let squeethEthPool: MockUniswapV3Pool;
  let uniPositionManager: MockUniPositionManager
  let weth: MockErc20;
  let wethIsToken0: boolean

  this.beforeAll("Setup environment", async () => {
    const MockSQUContract = await ethers.getContractFactory("MockWSqueeth");
    squeeth = (await MockSQUContract.deploy()) as MockWSqueeth;

    const MockErc20Contract = await ethers.getContractFactory("MockErc20");
    weth = (await MockErc20Contract.deploy("WETH", "WETH")) as MockErc20;

    const MockUniswapV3PoolContract = await ethers.getContractFactory("MockUniswapV3Pool");
    squeethEthPool = (await MockUniswapV3PoolContract.deploy()) as MockUniswapV3Pool;

    const MockPositionManager = await ethers.getContractFactory("MockUniPositionManager");
    uniPositionManager = (await MockPositionManager.deploy()) as MockUniPositionManager;

    // set token0 and token1 for squeeth/eth pool
    wethIsToken0 = parseInt(weth.address, 16) < parseInt(squeeth.address, 16)
    if (wethIsToken0) {
      await squeethEthPool.setPoolTokens(weth.address, squeeth.address);
    } else {
      await squeethEthPool.setPoolTokens(squeeth.address, weth.address);
    }
  });

  this.beforeAll("Deploy VaultLibTester", async () => {
    const VaultTester = await ethers.getContractFactory("VaultLibTester");
    vaultLib = (await VaultTester.deploy()) as VaultLibTester;
  })

  describe("#getUniPositionBalances tests", function () {
    let token0: string
    let token1: string

    describe('case: infinite range, price is always within range', async() => {
      const nftTokenId = 1
      const squeethETHPrice = '3000'
      let currentSqrtX96Price: string
      let currentTick: string
      const squeethLiquidityAmount = parseEther('0.001')
      const ethLiquidityAmount = parseEther('3')

      before('calculate shared variables', async( )=> {
        token0 = wethIsToken0 ? weth.address : squeeth.address
        token1 = wethIsToken0 ? squeeth.address : weth.address
      })

      before('calculate prices', async() => {
        const { sqrtPrice, tick } = getSqrtPriceAndTickBySqueethPrice(squeethETHPrice, wethIsToken0)
        currentSqrtX96Price = sqrtPrice
        currentTick = tick
      })

      before('set lp token properties, assuming entered when price is 3000', async () => {
        // infinite nft ticks
        const nftTickUpper = 887220
        const nftTickLower = -887220

        const liquidity = await vaultLib.getLiquidity(
          currentSqrtX96Price,
          nftTickLower,
          nftTickUpper,
          wethIsToken0 ? ethLiquidityAmount : squeethLiquidityAmount,
          wethIsToken0 ? squeethLiquidityAmount: ethLiquidityAmount,
        )
        await uniPositionManager.setMockedProperties(token0, token1, nftTickLower, nftTickUpper, liquidity)
      })

      before('set initial price', async() => {
        await squeethEthPool.setSlot0Data(currentSqrtX96Price, currentTick)
      })

      it('should get the squeeth / eth amount similar to our deposit amount', async() => {        
        const result = await vaultLib.getUniPositionBalances(uniPositionManager.address, nftTokenId, currentTick, wethIsToken0)
        // about 0.001 squeeth
        expect(isSimilar(result.squeethAmount.toString(), squeethLiquidityAmount.toString())).to.be.true
        // about 3 eth
        expect(isSimilar(result.ethAmount.toString(), ethLiquidityAmount.toString())).to.be.true
      })

      it('should get the correct squeeth / eth amount after price changes', async() => {
        const newPrice = '5000'
        const { sqrtPrice, tick: newTick } = getSqrtPriceAndTickBySqueethPrice(newPrice, wethIsToken0)
        await squeethEthPool.setSlot0Data(sqrtPrice, newTick)
        
        const { ethAmount, squeethAmount } = await vaultLib.getUniPositionBalances(
          uniPositionManager.address, 
          nftTokenId, 
          newTick,
          wethIsToken0
        )

        // x * y = k
        expect(isSimilar(ethAmount.mul(squeethAmount).toString(), ethLiquidityAmount.mul(squeethLiquidityAmount).toString())).to.be.true
        // eth / squeeth is similar to new price
        expect(isSimilar(ethAmount.div(squeethAmount).toString(), newPrice, 3)).to.be.true
      })
    })
    
    describe('case: LP only in a certain range', async() => {
      const nftTokenId = 1
      const initSqueethPrice = '3000'
      let initSqrtX96Price: string
      let initTick: string

      let squeethLiquidityAmount: BigNumber
      const ethLiquidityAmount = parseEther('30')

      let liquidity: BigNumber

      before('calculate shared variables', async( )=> {
        token0 = wethIsToken0 ? weth.address : squeeth.address
        token1 = wethIsToken0 ? squeeth.address : weth.address
      })

      before('set price parameters', async() => {
        const { sqrtPrice, tick } = getSqrtPriceAndTickBySqueethPrice(initSqueethPrice, wethIsToken0)
        initSqrtX96Price = sqrtPrice
        initTick = tick
      })

      before('set LP token properties, assuming with enter with init price.', async() => {
        const { sqrtPrice: sqrtPriceInit } = getSqrtPriceAndTickBySqueethPrice(initSqueethPrice, wethIsToken0)
        const { sqrtPrice: sqrtPrice4500, tick: tick4000 } = getSqrtPriceAndTickBySqueethPrice('4500', wethIsToken0)
        const { sqrtPrice: sqrtPrice2000, tick: tick2000 } = getSqrtPriceAndTickBySqueethPrice('2000', wethIsToken0)

        // get approximate liquidity value, with 30 eth deposit
        liquidity = wethIsToken0
          ? await vaultLib.getLiquidityForAmount0(sqrtPriceInit, sqrtPrice2000, ethLiquidityAmount.toString())
          : await vaultLib.getLiquidityForAmount1(sqrtPriceInit, sqrtPrice2000, ethLiquidityAmount.toString())

        const tickUpper = wethIsToken0 ? tick2000 : tick4000;
        const tickLower = wethIsToken0 ? tick4000 : tick2000;

        const result = await vaultLib.getAmountsForLiquidity(sqrtPriceInit, sqrtPrice2000, sqrtPrice4500, liquidity)

        // set reasonable squeeth liquidity amount
        squeethLiquidityAmount = wethIsToken0 
          ? result.amount1
          : result.amount0

        // set property: liquidity and ticks
        await uniPositionManager.setMockedProperties(token0, token1, tickLower, tickUpper, liquidity)
      })

      describe('case: price remains the same, we\'re in the range', async() => {
        before('set initial price', async() => {
          await squeethEthPool.setSlot0Data(initSqrtX96Price, initTick)
        })
        it('should return approximate amount', async() => {
          const result = await vaultLib.getUniPositionBalances(
            uniPositionManager.address, 
            nftTokenId, 
            initTick,
            wethIsToken0
          )
          // about 0.01 squeeth
          expect(isSimilar(result.squeethAmount.toString(), squeethLiquidityAmount.toString(), 3)).to.be.true
          // about 30 eth
          expect(isSimilar(result.ethAmount.toString(), ethLiquidityAmount.toString(), 3)).to.be.true
        })
      })

      describe('case: current price is 5000, above the LP range', async() => {
        const highPrice = '5000'
        let newTick: string;
        before('set price', async() => {
          const { sqrtPrice, tick } = getSqrtPriceAndTickBySqueethPrice(highPrice, wethIsToken0)
          newTick = tick
          await squeethEthPool.setSlot0Data(sqrtPrice, tick)
        })
        it('should return expected amount of squeeth and eth', async() => {
          const result = await vaultLib.getUniPositionBalances(
            uniPositionManager.address, 
            nftTokenId, 
            newTick,
            wethIsToken0
          )
          expect(result.squeethAmount.isZero()).to.be.true

          const expectedEthAmount = wethIsToken0
            ? getXAmountBelowRange((1/4500), (1/2000), liquidity.toString())
            : getYAmountAboveRange(2000, 4500, liquidity.toString())                
          
          expect(isSimilar(result.ethAmount.toString(), expectedEthAmount.toString())).to.be.true
        })
      })

      describe('case: current price 1900, below the LP range', async() => {
        const lowPrice = '1900'
        let newTick: string;
        before('set price', async() => {
          const { sqrtPrice, tick } = getSqrtPriceAndTickBySqueethPrice(lowPrice, wethIsToken0)
          newTick = tick;
          await squeethEthPool.setSlot0Data(sqrtPrice, tick)
        })
        it('should return expected amount of squeeth and eth', async() => {
          const result = await vaultLib.getUniPositionBalances(
            uniPositionManager.address, 
            nftTokenId,
            newTick,
            wethIsToken0
          )
          expect(result.ethAmount.isZero()).to.be.true

          const expectedSqueethAmount = wethIsToken0
            ? getYAmountAboveRange((1/4500), (1/2000), liquidity.toString()) // price 1/1900 is above 1/2000
            : getXAmountBelowRange(2000, 4500, liquidity.toString()) // price 1900 is below 2000
        
          expect(isSimilar(result.squeethAmount.toString(), expectedSqueethAmount.toString())).to.be.true             

        })
      })

      describe('case: current price 2200, within LP range', async() => {
        const newPrice = '2200'
        let newTick: string
        before('set price', async() => {
          const { sqrtPrice, tick } = getSqrtPriceAndTickBySqueethPrice(newPrice, wethIsToken0)
          newTick = tick;
          await squeethEthPool.setSlot0Data(sqrtPrice, tick)
          
        })
        it('should return expected amount of squeeth and eth', async() => {
          const result = await vaultLib.getUniPositionBalances(
            uniPositionManager.address, 
            nftTokenId, 
            newTick,
            wethIsToken0
          )
          
          const expectedEthAmount = wethIsToken0
            ? getXAmountBelowRange((1/2200), (1/2000), liquidity.toString())
            : getYAmountAboveRange(2000, 2200, liquidity.toString())    
          
          expect(isSimilar(result.ethAmount.toString(), expectedEthAmount.toString(), 3)).to.be.true
          
          const expectedSqueethAmount = wethIsToken0
            ? getYAmountAboveRange((1/4500), (1/2200), liquidity.toString())
            : getXAmountBelowRange(2200, 4500, liquidity.toString())

          expect(isSimilar(result.squeethAmount.toString(), expectedSqueethAmount.toString())).to.be.true
        })
      })
    })
  });
});

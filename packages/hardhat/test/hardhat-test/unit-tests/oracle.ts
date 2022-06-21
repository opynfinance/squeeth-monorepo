import { ethers, getNamedAccounts, deployments } from "hardhat"
import { expect } from "chai";
import { constants, Contract } from "ethers";
import { BigNumber as BigNumberJs } from "bignumber.js";
import {
  abi as SWAP_ROUTER_ABI,
  bytecode as SWAP_ROUTER_BYTECODE,
} from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json'
import {
  abi as POSITION_MANAGER_ABI,
  bytecode as POSITION_MANAGER_BYTECODE,
} from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'
import {
  abi as FACTORY_ABI,
  bytecode as FACTORY_BYTECODE,
} from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'
import { convertToken0PriceToSqrtX96Price, tickToPrice1e18 } from '../calculator'
import { getNow, isSimilar } from '../utils'
import { Oracle, MockWPowerPerp, OracleTester, WETH9, ISwapRouter, IUniswapV3Pool } from "../../../typechain";

describe("Oracle", function () {
  const squeethPriceInETH = 2000; // can sell 1 squeeth for 2000 eth
  let initPriceTick: number
  let isWethToken0: boolean

  const squeethPriceInETH1e18 = (squeethPriceInETH * 1e18).toString()
  const provider = ethers.provider;
  
  let squeeth: MockWPowerPerp;
  let oracle: Oracle;
  let positionManager: Contract
  let oracleTester: OracleTester
  let squeethPool: IUniswapV3Pool
  let deployer: string
  let swapRouter: ISwapRouter
  // store list of timestamp that's the pool is touched. [0] = init time, [1] = first interaction ...
  const interactionTimestamps: number[] = []

  let weth: WETH9

  this.beforeAll("Deploy uniswap protocol & setup uniswap pool", async() => {
    const { deployer: _deployer } = await getNamedAccounts();
    deployer = _deployer

    const { deploy } = deployments;
  
    await deploy("UniswapV3Factory", {
      from: deployer,
      contract: {
        abi: FACTORY_ABI,
        bytecode: FACTORY_BYTECODE
      }
    });
    const uniswapFactory = await ethers.getContract("UniswapV3Factory", deployer);
    
    await deploy("WETH9", { from: deployer });
    weth = await ethers.getContract("WETH9", deployer) as WETH9;
  
    const tx = await deploy("SwapRouter", {
      from: deployer,
      contract: {
        abi: SWAP_ROUTER_ABI,
        bytecode: SWAP_ROUTER_BYTECODE
      },
      args: [uniswapFactory.address, weth.address]
    });

    swapRouter = await ethers.getContractAt('ISwapRouter', tx.address)
  
    // tokenDescriptor is only used to query tokenURI() on NFT. Don't need that in our deployment
    const tokenDescriptorAddress = ethers.constants.AddressZero
    await deploy("NonfungibleTokenPositionManager", {
      from: deployer,
      contract: {
        abi: POSITION_MANAGER_ABI,
        bytecode: POSITION_MANAGER_BYTECODE,
      },
      args: [uniswapFactory.address, weth.address, tokenDescriptorAddress]
    });
    positionManager = await ethers.getContract("NonfungibleTokenPositionManager", deployer);

    // Create ETH/SQUEETH Pool with positionManager
    squeeth = (await (await ethers.getContractFactory("MockWPowerPerp")).deploy()) as MockWPowerPerp;
    isWethToken0 = parseInt(weth.address, 16) < parseInt(squeeth.address, 16)
    

    const sqrtX96Price = isWethToken0 
      ? convertToken0PriceToSqrtX96Price((new BigNumberJs(1).div(squeethPriceInETH)).toString()).toFixed(0)
      : convertToken0PriceToSqrtX96Price(squeethPriceInETH.toString()).toFixed(0)
     

    const token0 = isWethToken0 ? weth.address : squeeth.address
    const token1 = isWethToken0 ? squeeth.address : weth.address

    // https://docs.uniswap.org/protocol/reference/periphery/base/PoolInitializer
    const res = await positionManager.createAndInitializePoolIfNecessary(
      token0,
      token1,
      3000, // fee = 0.3%
      sqrtX96Price
    )


    // keep track of init block timestamp
    const initBlockNumber = res.blockNumber
    const block = await provider.getBlock(initBlockNumber)
    // add init timestamp to array
    interactionTimestamps.push(block.timestamp)

    // set pool
    const squeethPoolAddr = await uniswapFactory.getPool(token0, token1, 3000)
    squeethPool = await ethers.getContractAt("IUniswapV3Pool", squeethPoolAddr);
    initPriceTick = (await squeethPool.slot0()).tick
    const cardinality = (await squeethPool.slot0()).observationCardinality

    // the cardinality will be started with 1
    expect(cardinality).to.be.eq(1)

    // deploy oracle
    oracle = (await (await ethers.getContractFactory("Oracle")).deploy()) as Oracle;

    await deploy("OracleTester", { args: [oracle.address], from: deployer })
    oracleTester = (await (await ethers.getContractFactory("OracleTester")).deploy(oracle.address)) as OracleTester;
  })

  describe("Fetch price right after initialization", async () => {
    it("should return initial price with period = 1", async () => {
      const price = new BigNumberJs((await oracle.getTwap(squeethPool.address, squeeth.address, weth.address, 1, false)).toString())
      expect(isSimilar(price.toString(), squeethPriceInETH1e18)).to.be.true;
    })
    it('should be able to get TWAP since init time', async() => {
      const price = new BigNumberJs((
        await oracleTester.testGetTwapSince(interactionTimestamps[0], squeethPool.address, squeeth.address, weth.address))
        .toString())
      expect(isSimilar(price.toString(), squeethPriceInETH1e18)).to.be.true;
    })
    it('should be able to get TWAP since init time after time goes by', async() => {
      await provider.send("evm_increaseTime", [50]) // go 50 seconds minutes
      await provider.send("evm_mine", [])
      const price = new BigNumberJs((
        await oracleTester.testGetTwapSince(interactionTimestamps[0], squeethPool.address, squeeth.address, weth.address))
        .toString())
      expect(isSimilar(price.toString(), squeethPriceInETH1e18)).to.be.true;
    })
    it("should revert if trying to request twap since a time before initialization", async () => {
      await expect(
        oracleTester.testGetTwapSince(interactionTimestamps[0] - 1, squeethPool.address, squeeth.address, weth.address)
      ).to.be.revertedWith("OLD");
    })

    it("should NOT revert if trying to request twap since a time before initialization, with #getTwapSafe", async () => {
      const price = new BigNumberJs((
        await oracleTester.testGetTwapSafeSince(interactionTimestamps[0] - 1, squeethPool.address, squeeth.address, weth.address)
      ).toString());
      expect(isSimilar(price.toString(), squeethPriceInETH1e18)).to.be.true;
    })
    it('should return max period', async() => {
      const period = await oracle.getMaxPeriod(squeethPool.address)
      const now = await getNow(provider)
      expect(interactionTimestamps[0] + period === now).to.be.true
    })
  })
  
  describe("Fetch price after touching the pool", async () => {
    before('add liquidity to the pool', async() => {
      const squeethAmount = 1
      const wethAmount = squeethPriceInETH * squeethAmount

      const liquiditySqueethAmount = ethers.utils.parseEther(squeethAmount.toString())
      const liquidityWethAmount = ethers.utils.parseEther(wethAmount.toString())

      await squeeth.mint(deployer, liquiditySqueethAmount)
      await weth.deposit({value: liquidityWethAmount})

      await weth.approve(positionManager.address, ethers.constants.MaxUint256)
      await squeeth.approve(positionManager.address, ethers.constants.MaxUint256)
      
      const token0 = isWethToken0 ? weth.address : squeeth.address
      const token1 = isWethToken0 ? squeeth.address : weth.address

      const mintParam = {
        token0,
        token1,
        fee: 3000,
        tickLower: -887220,// int24 min tick used when selecting full range
        tickUpper: 887220,// int24 max tick used when selecting full range
        amount0Desired: isWethToken0 ? liquidityWethAmount : liquiditySqueethAmount,
        amount1Desired: isWethToken0 ? liquiditySqueethAmount : liquidityWethAmount,
        amount0Min: 0,
        amount1Min: 0,
        recipient: deployer,// address
        deadline: await getNow(provider) + 86400
      }
      const res = await positionManager.mint(mintParam)
      const addLiquidityBlock = res.blockNumber
      const block = await provider.getBlock(addLiquidityBlock)
      interactionTimestamps.push(block.timestamp)

      
    })
    it('should revert if requesting TWAP from init timestamp', async() => {
      await expect(
        oracleTester.testGetTwapSince(interactionTimestamps[0], squeethPool.address, squeeth.address, weth.address)
      ).to.be.revertedWith("OLD");
    })
    // todo: Fix this!
    // it will be good if the test fail in the future, which means that we solve this potential bug.
    it("should be fix in the future: if first observation is updated in the same block, the max duration will be 0 causing the library to revert.", async () => {
      await expect(
        oracleTester.testGetTwapSafeSince(interactionTimestamps[0], squeethPool.address, squeeth.address, weth.address)
      ).to.be.revertedWith("BP"); // revert by OracleLibrary.
    })
    it("should NOT revert if requesting TWAP from init timestamp, with #getTwapSafe", async () => {
      // fix view function stimulation on hardhat that the blocktime will be same as latest block
      // causing max period to request = 0;
      await provider.send("evm_mine", [])
      
      const price = new BigNumberJs((
        await oracleTester.testGetTwapSafeSince(interactionTimestamps[0], squeethPool.address, squeeth.address, weth.address)
      ).toString());
      expect(isSimilar(price.toString(), squeethPriceInETH1e18)).to.be.true;
    })
    it("should NOT revert if requesting time weighted tick from init timestamp, with #getWeightedTickSafe", async () => {
      const tick = await oracleTester.testGetWeightedTickSafe(interactionTimestamps[0], squeethPool.address, )
      expect(initPriceTick === tick).to.be.true
    })
    it('should be able to get TWAP since last touch', async() => {
      await provider.send("evm_increaseTime", [50]) // go 50 seconds minutes
      await provider.send("evm_mine", [])
      const price = new BigNumberJs((
        await oracleTester.testGetTwapSince(interactionTimestamps[1], squeethPool.address, squeeth.address, weth.address))
        .toString())
      expect(isSimilar(price.toString(), squeethPriceInETH1e18)).to.be.true;
    })
    it("should revert if trying to request twap since a time before last touch", async () => {
      await expect(
        oracleTester.testGetTwapSince(interactionTimestamps[1] - 1, squeethPool.address, squeeth.address, weth.address)
      ).to.be.revertedWith("OLD");
    })
    it("should NOT revert if trying to request twap since a time before last touch, with #getTwapSafe", async () => {
      const price = new BigNumberJs((
        await oracleTester.testGetTwapSafeSince(interactionTimestamps[1] - 1, squeethPool.address, squeeth.address, weth.address)
      ).toString());
      expect(isSimilar(price.toString(), squeethPriceInETH1e18)).to.be.true;
    })
    it("should NOT revert if trying to request average tick since a time before last touch, with #testGetWeightedTickSafe", async () => {
      const tick = await oracleTester.testGetWeightedTickSafe(interactionTimestamps[1] - 1, squeethPool.address)
      expect(initPriceTick === tick).to.be.true;
    })
    it('should return max period as timestamp[1] til now', async() => {
      const period = await oracle.getMaxPeriod(squeethPool.address)
      const now = await getNow(provider)
      expect(interactionTimestamps[1] + period === now).to.be.true
    })
  })
  
  describe("Fetch price after adding storage slot", async () => {
    before('increase storage slot', async() => {
      // increase storage slot to 16
      await squeethPool.increaseObservationCardinalityNext(16)
      await provider.send("evm_mine", [])
    })
    before('add liquidity to the pool', async() => {
      const squeethAmount = 1
      const wethAmount = squeethPriceInETH * squeethAmount
      const liquiditySqueethAmount = ethers.utils.parseEther(squeethAmount.toString())
      const liquidityWethAmount = ethers.utils.parseEther(wethAmount.toString())
      await squeeth.mint(deployer, liquiditySqueethAmount)
      await weth.deposit({value: liquidityWethAmount})

      const token0 = isWethToken0 ? weth.address : squeeth.address
      const token1 = isWethToken0 ? squeeth.address : weth.address

      const mintParam = {
        token0,
        token1,
        fee: 3000,
        tickLower: -887220,// int24 min tick used when selecting full range
        tickUpper: 887220,// int24 max tick used when selecting full range
        amount0Desired: isWethToken0 ? liquidityWethAmount : liquiditySqueethAmount,
        amount1Desired: isWethToken0 ? liquiditySqueethAmount : liquidityWethAmount,
        amount0Min: 0,
        amount1Min: 0,
        recipient: deployer,// address
        deadline: await getNow(provider) + 86400
      }
      const res = await positionManager.mint(mintParam)
      const initBlockNumber = res.blockNumber
      const block = await provider.getBlock(initBlockNumber)
      
      // interactionTimestamps[2] = second touch timestamp
      interactionTimestamps.push(block.timestamp)
      await provider.send("evm_mine", [])
    })
    before('increase timestamp', async () => {
      await provider.send("evm_increaseTime", [50]) // go 50 seconds minutes
      await provider.send("evm_mine", [])
    })
    it('should revert if requesting TWAP from init timestamp', async() => {
      await expect(
        oracleTester.testGetTwapSince(interactionTimestamps[0], squeethPool.address, squeeth.address, weth.address)
      ).to.be.revertedWith("OLD");
    })
    it("should NOT revert if requesting TWAP from init timestamp, with #getTwapSafe", async () => {
      const price = new BigNumberJs((
        await oracleTester.testGetTwapSafeSince(interactionTimestamps[0], squeethPool.address, squeeth.address, weth.address)
      ).toString());
      expect(isSimilar(price.toString(), squeethPriceInETH1e18)).to.be.true;
    })
    it("should NOT revert if requesting time weighted tick from init timestamp, with #getWeightedTickSafe", async () => {
      const tick = await oracleTester.testGetWeightedTickSafe(interactionTimestamps[0], squeethPool.address, )
      expect(initPriceTick === tick).to.be.true
    })
    it('should be able to get TWAP since first touch', async() => {
      const price = new BigNumberJs((
        await oracleTester.testGetTwapSince(interactionTimestamps[1], squeethPool.address, squeeth.address, weth.address))
        .toString())
      expect(isSimilar(price.toString(), squeethPriceInETH1e18)).to.be.true;
    })
    it("should revert if trying to request twap since a time before first touch", async () => {
      await expect(
        oracleTester.testGetTwapSince(interactionTimestamps[1] - 1, squeethPool.address, squeeth.address, weth.address)
      ).to.be.revertedWith("OLD");
    })
    it("should NOT revert if trying to request twap since a time before first touch, with #getTwapSafe", async () => {
      const price = new BigNumberJs((
        await oracleTester.testGetTwapSafeSince(interactionTimestamps[1] - 1, squeethPool.address, squeeth.address, weth.address)
      ).toString());
      expect(isSimilar(price.toString(), squeethPriceInETH1e18)).to.be.true;
    })
    it("should NOT revert if requesting time weighted tick since a time before first touch, with #getWeightedTickSafe", async () => {
      const tick = await oracleTester.testGetWeightedTickSafe(interactionTimestamps[1] - 1, squeethPool.address, )
      expect(initPriceTick === tick).to.be.true
    })
    it('should be able to get TWAP since second touch', async() => {
      const price = new BigNumberJs((
        await oracleTester.testGetTwapSince(interactionTimestamps[2], squeethPool.address, squeeth.address, weth.address))
        .toString())
      expect(isSimilar(price.toString(), squeethPriceInETH1e18)).to.be.true;
    })
    it("should be able to get time weighted tick from second touch, with #getWeightedTickSafe", async () => {
      const tick = await oracleTester.testGetWeightedTickSafe(interactionTimestamps[2], squeethPool.address, )
      expect(tick === initPriceTick).to.be.true
    })
    it('should be able to get TWAP since time between first touch and second touch with #getTwapSafe', async() => {
      const period = Math.floor((interactionTimestamps[2] + interactionTimestamps[1]) / 2)
      const price = new BigNumberJs((
        await oracleTester.testGetTwapSafeSince(period, squeethPool.address, squeeth.address, weth.address))
        .toString())
      expect(isSimilar(price.toString(), squeethPriceInETH1e18)).to.be.true;
    })

    it('should be able to get a historical TWAP from now until first interaction and it should match a normal twap', async() => {
      const price = new BigNumberJs((
        await oracleTester.testGetHistoricalTwapToNow(interactionTimestamps[1], squeethPool.address, squeeth.address, weth.address))
        .toString())
      const priceTwap = new BigNumberJs((
        await oracleTester.testGetTwapSince(interactionTimestamps[1], squeethPool.address, squeeth.address, weth.address))
        .toString())
  
      expect(isSimilar(price.toString(), squeethPriceInETH1e18)).to.be.true;
      expect(price.eq(priceTwap)).to.be.true
    })

    it('should be able to get a historical TWAP from second interaction to first interaction', async() => {
      const price = new BigNumberJs((
        await oracleTester.testGetHistoricalTwap(interactionTimestamps[1], interactionTimestamps[2], squeethPool.address, squeeth.address, weth.address))
        .toString())
  
      expect(isSimilar(price.toString(), squeethPriceInETH1e18, 3)).to.be.true;
    })

    it('should be able to get TWAP since second touch with #getTwapSafe', async() => {
      const price = new BigNumberJs((
        await oracleTester.testGetTwapSafeSince(interactionTimestamps[2], squeethPool.address, squeeth.address, weth.address))
        .toString())
      expect(isSimilar(price.toString(), squeethPriceInETH1e18)).to.be.true;
    })
  })
  
  // make sure the TWAP is calculated correctly
  describe("oracle tick is time weighted", async () => {
    
    let startTimestamp: number
    const period = 60
    let oldTick: number
    let newTick: number
    before('increase storage slot', async() => {
      await squeethPool.increaseObservationCardinalityNext(16)
    })
    before('setup time', async() => {
      const { tick } = await squeethPool.slot0()
      oldTick = tick
      startTimestamp = await getNow(provider)
      
    })
    before('increase price by buying from the pool', async () => {
      const poolWethBalance = await weth.balanceOf(squeethPool.address)
      const buyAmount = poolWethBalance.div(10)
      await weth.deposit({value: buyAmount})
      await weth.approve(swapRouter.address, constants.MaxUint256)
      const params = {
        tokenIn: weth.address,
        tokenOut: squeeth.address,
        fee: 3000,
        recipient: deployer,
        deadline: await getNow(provider) + 100000, // uint256
        amountIn: buyAmount,
        amountOutMinimum: 0,
        sqrtPriceLimitX96: 0,
      }

      await provider.send("evm_setNextBlockTimestamp", [startTimestamp + period]) 
      await swapRouter.exactInputSingle(params)

      const { tick } = await squeethPool.slot0()
      newTick = tick
    })

    it('tick should return the average when each price has same weight ', async() => {
      await provider.send("evm_setNextBlockTimestamp", [startTimestamp + period*2]) 
      await provider.send("evm_mine", [])
      // price:            | old tick | new tick |
      // time period: start|  period  |  period  | now 
      const timeWeightedTick = await oracle.getTimeWeightedAverageTickSafe(squeethPool.address, period*2)
      expect(isSimilar(timeWeightedTick.toString(), ((newTick + oldTick) / 2).toString())).to.be.true

      // check price returned by oracle match the tick
      const twap = await oracle.getTwap(squeethPool.address, squeeth.address, weth.address, period*2, false)
      const twapSafe = await oracle.getTwap(squeethPool.address, squeeth.address, weth.address, period*2, true)

      const tickToUse = isWethToken0 ? -timeWeightedTick : timeWeightedTick
      const expectedTwap = tickToPrice1e18(tickToUse)
      
      expect(isSimilar(twap.toString(), expectedTwap)).to.be.true
      expect(twap.eq(twapSafe)).to.be.true
    })

    it('tick should return the weighed average when price does not have same weight', async() => {
      await provider.send("evm_setNextBlockTimestamp", [startTimestamp + period*3]) 
      await provider.send("evm_mine", [])
      // price:            | old tick | new tick           |
      // time period: start| period   | 2 * period         | now 
      const timeWeightedTick = await oracle.getTimeWeightedAverageTickSafe(squeethPool.address, period*3)
      expect(isSimilar(timeWeightedTick.toString(), ((newTick*2 + oldTick) / 3).toString())).to.be.true

      // check price returned by oracle match the tick
      const twap = await oracle.getTwap(squeethPool.address, squeeth.address, weth.address, period*3, false)
      const twapSafe = await oracle.getTwap(squeethPool.address, squeeth.address, weth.address, period*3, true)
      const tickToUse = isWethToken0 ? -timeWeightedTick : timeWeightedTick
      const expectedTwap = tickToPrice1e18(tickToUse)

      expect(isSimilar(twap.toString(), expectedTwap.toString())).to.be.true
      expect(twap.eq(twapSafe)).to.be.true
    })
    
  })
})
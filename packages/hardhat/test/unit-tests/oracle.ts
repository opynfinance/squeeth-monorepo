import { ethers, getNamedAccounts, deployments } from "hardhat"
import { expect } from "chai";
import BigNumber, { BigNumber as BigNumberJs } from "bignumber.js";
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
import { Contract } from "ethers";
import { convertNormalPriceToSqrtX96Price } from '../calculator'
import { isSimilar } from '../utils'
import { Oracle, MockWSqueeth, OracleTester, WETH9 } from "../../typechain";

describe("Oracle", function () {
  const squeethPriceInETH = 2000; // can sell 1 squeeth for 2000 eth
  const squeethPriceInETH1e18 = (squeethPriceInETH * 1e18).toString()
  const provider = ethers.provider;
  let squeeth: MockWSqueeth;
  let oracle: Oracle;
  let positionManager: Contract
  let oracleTester: OracleTester
  let squeethPool: Contract
  let deployer: string
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
  
    await deploy("SwapRouter", {
      from: deployer,
      contract: {
        abi: SWAP_ROUTER_ABI,
        bytecode: SWAP_ROUTER_BYTECODE
      },
      args: [uniswapFactory.address, weth.address]
    });
  
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
    squeeth = (await (await ethers.getContractFactory("MockWSqueeth")).deploy()) as MockWSqueeth;
    const isWethToken0 = parseInt(weth.address, 16) < parseInt(squeeth.address, 16)

    const sqrtX96Price = isWethToken0 
      ? convertNormalPriceToSqrtX96Price(squeethPriceInETH.toString()).toFixed(0)
      : convertNormalPriceToSqrtX96Price((new BigNumber(1).div(squeethPriceInETH)).toString()).toFixed(0)
     

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

    // deploy oracle
    oracle = (await (await ethers.getContractFactory("Oracle")).deploy()) as Oracle;

    await deploy("OracleTester", { args: [oracle.address], from: deployer })
    oracleTester = (await (await ethers.getContractFactory("OracleTester")).deploy(oracle.address)) as OracleTester;

  })

  describe("Fetch price right after initialization", async () => {
    it("should return initial price with period = 1", async () => {
      const price = new BigNumberJs((await oracle.getTwaPrice(squeethPool.address, squeeth.address, weth.address, 1)).toString())
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
      
      const isWethToken0 = parseInt(weth.address, 16) < parseInt(squeeth.address, 16)
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
        deadline: Math.floor(Date.now() / 1000 + 86400),// uint256
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

      const isWethToken0 = parseInt(weth.address, 16) < parseInt(squeeth.address, 16)
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
        deadline: Math.floor(Date.now() / 1000 + 86400),// uint256
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
    it('should be able to get TWAP since second touch', async() => {
      const price = new BigNumberJs((
        await oracleTester.testGetTwapSince(interactionTimestamps[2], squeethPool.address, squeeth.address, weth.address))
        .toString())
      expect(isSimilar(price.toString(), squeethPriceInETH1e18)).to.be.true;
    })
    it('should be able to get TWAP since time between first touch and second touch with #getTwapSafe', async() => {
      const period = Math.floor((interactionTimestamps[2] + interactionTimestamps[1]) / 2)
      const price = new BigNumberJs((
        await oracleTester.testGetTwapSafeSince(period, squeethPool.address, squeeth.address, weth.address))
        .toString())
      expect(isSimilar(price.toString(), squeethPriceInETH1e18)).to.be.true;
    })
    it('should be able to get TWAP since second touch with #getTwapSafe', async() => {
      const price = new BigNumberJs((
        await oracleTester.testGetTwapSafeSince(interactionTimestamps[2], squeethPool.address, squeeth.address, weth.address))
        .toString())
      expect(isSimilar(price.toString(), squeethPriceInETH1e18)).to.be.true;
    })
  })
})

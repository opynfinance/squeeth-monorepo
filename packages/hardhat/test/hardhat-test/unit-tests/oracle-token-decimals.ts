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
import { convertToken0PriceToSqrtX96Price } from '../calculator'
import { isSimilar } from '../utils'
import { Oracle, MockErc20 } from "../../../typechain";

describe("Oracle", function () {
  const ethRawPrice = 2000; // target eth price in USD
  const ethRawPrice1e18 = (ethRawPrice * 1e18).toString()
  const provider = ethers.provider;
  
  let weth: MockErc20
  let usdc: MockErc20 // USD token with 6 decimals
  let randomUSD: MockErc20 // rUSD token with 20 decimals

  let oracle: Oracle;
  let positionManager: Contract
  let uniswapFactory: Contract

  let wethUSDPool1: Contract
  let wethUSDPool2: Contract
  let deployer: string

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
    uniswapFactory = await ethers.getContract("UniswapV3Factory", deployer);
    
  
    const MockErc20Contract = await ethers.getContractFactory("MockErc20");
    usdc = (await MockErc20Contract.deploy("USDC", "USDC", 6)) as MockErc20;
    weth = (await MockErc20Contract.deploy("WETH", "WETH", 18)) as MockErc20;
    randomUSD = (await MockErc20Contract.deploy("rUSD", "rUSD", 20)) as MockErc20;

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

    
    // deploy oracle
    oracle = (await (await ethers.getContractFactory("Oracle")).deploy()) as Oracle;
  })

  

  describe("ETH/USD pool", async () => {

    before('setup weth/usdc pool', async() => {
      const isUSDToken0 = parseInt(usdc.address, 16) < parseInt(weth.address, 16)
  
      const weiPriceInUSDCWei = new BigNumber(ethRawPrice).div(new BigNumber(10).pow(18 - 6))

      const sqrtX96Price = isUSDToken0 
        ? convertToken0PriceToSqrtX96Price((new BigNumber(1).div(weiPriceInUSDCWei)).toString()).toFixed(0)
        : convertToken0PriceToSqrtX96Price(weiPriceInUSDCWei.toString()).toFixed(0)

      const token0 = isUSDToken0 ? usdc.address : weth.address
      const token1 = isUSDToken0 ? weth.address : usdc.address
  
      await positionManager.createAndInitializePoolIfNecessary(
        token0,
        token1,
        3000, // fee = 0.3%
        sqrtX96Price
      )
  
  
      // set pool
      const wethPool1 = await uniswapFactory.getPool(token0, token1, 3000)
      wethUSDPool1 = await ethers.getContractAt("IUniswapV3Pool", wethPool1);

    })

    before('increase storage slot', async() => {
      // increase storage slot to 16
      await wethUSDPool1.increaseObservationCardinalityNext(16)
      await provider.send("evm_increaseTime", [30])
      await provider.send("evm_mine", [])
    })

    it("should return initial price with period = 1", async () => {
      const price = new BigNumberJs((await oracle.getTwap(wethUSDPool1.address, weth.address, usdc.address, 1, true)).toString())
      expect(isSimilar(price.toString(), ethRawPrice1e18)).to.be.true;
    })

    it("should return correct price with safe twap", async () => {
      const price = new BigNumberJs((await oracle.getTwap(wethUSDPool1.address, weth.address, usdc.address, 86400, true)).toString())
      expect(isSimilar(price.toString(), ethRawPrice1e18)).to.be.true;
    })
  })

  describe("ETH/rUSD pool", async () => {

    before('setup weth/rUsdc pool', async() => {
      const isUSDToken0 = parseInt(randomUSD.address, 16) < parseInt(weth.address, 16)
  
      const weiPriceInRUSDCWei = new BigNumber(ethRawPrice).times(new BigNumber(10).pow(20 - 18))

      const sqrtX96Price = isUSDToken0 
        ? convertToken0PriceToSqrtX96Price((new BigNumber(1).div(weiPriceInRUSDCWei)).toString()).toFixed(0)
        : convertToken0PriceToSqrtX96Price(weiPriceInRUSDCWei.toString()).toFixed(0)

      const token0 = isUSDToken0 ? randomUSD.address : weth.address
      const token1 = isUSDToken0 ? weth.address : randomUSD.address
  
      await positionManager.createAndInitializePoolIfNecessary(
        token0,
        token1,
        3000, // fee = 0.3%
        sqrtX96Price
      )
  
      // set pool
      const wethPool1 = await uniswapFactory.getPool(token0, token1, 3000)
      wethUSDPool2 = await ethers.getContractAt("IUniswapV3Pool", wethPool1);

    })

    before('increase storage slot', async() => {
      // increase storage slot to 16
      await wethUSDPool2.increaseObservationCardinalityNext(16)
      await provider.send("evm_increaseTime", [30])
      await provider.send("evm_mine", [])
    })

    it("should return initial price with period = 1", async () => {
      const price = new BigNumberJs((await oracle.getTwap(wethUSDPool2.address, weth.address, randomUSD.address, 1, false)).toString())
      expect(isSimilar(price.toString(), ethRawPrice1e18)).to.be.true;
    })

    it("should return correct price with safe twap", async () => {
      const price = new BigNumberJs((await oracle.getTwap(wethUSDPool2.address, weth.address, randomUSD.address, 86400, true)).toString())
      expect(isSimilar(price.toString(), ethRawPrice1e18)).to.be.true;
    })
  })

})

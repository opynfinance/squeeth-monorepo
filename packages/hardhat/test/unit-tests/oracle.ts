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

import { Oracle, MockWSqueeth } from "../../typechain";

describe("Oracle", function () {
  const squeethPriceInETH = 2000; // can sell 1 squeeth = 2000 eth

  let squeeth: MockWSqueeth;
  let oracle: Oracle;
  let squeethPool: string

  let weth: Contract

  this.beforeAll("Deploy uniswap protocol & setup uniswap pool", async() => {
    const { deployer } = await getNamedAccounts();
    const { deploy } = deployments;
  
    await deploy("UniswapV3Factory", {
      from: deployer,
      log: true,
      contract: {
        abi: FACTORY_ABI,
        bytecode: FACTORY_BYTECODE
      }
    });
    const uniswapFactory = await ethers.getContract("UniswapV3Factory", deployer);
    
    await deploy("WETH9", {
      from: deployer,
      log: true,
    });
    weth = await ethers.getContract("WETH9", deployer);
  
    await deploy("SwapRouter", {
      from: deployer,
      log: true,
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
      log: true,
      contract: {
        abi: POSITION_MANAGER_ABI,
        bytecode: POSITION_MANAGER_BYTECODE,
      },
      args: [uniswapFactory.address, weth.address, tokenDescriptorAddress]
    });
    const positionManager = await ethers.getContract("NonfungibleTokenPositionManager", deployer);

    // Create ETH/SQUEETH Pool with positionManager
    squeeth = (await (await ethers.getContractFactory("MockWSqueeth")).deploy()) as MockWSqueeth;
    const isWethToken0 = parseInt(weth.address, 16) < parseInt(squeeth.address, 16)

    const sqrtX96Price = isWethToken0 
      ? convertNormalPriceToSqrtX96Price(squeethPriceInETH.toString()).toFixed(0)
      : convertNormalPriceToSqrtX96Price((new BigNumber(1).div(squeethPriceInETH)).toString()).toFixed(0)
     

    const token0 = isWethToken0 ? weth.address : squeeth.address
    const token1 = isWethToken0 ? squeeth.address : weth.address

    // https://docs.uniswap.org/protocol/reference/periphery/base/PoolInitializer
    await positionManager.createAndInitializePoolIfNecessary(
      token0,
      token1,
      3000, // fee = 0.3%
      sqrtX96Price
    )

    squeethPool = await uniswapFactory.getPool(token0, token1, 3000)

    // deploy oracle
    oracle = (await (await ethers.getContractFactory("Oracle")).deploy()) as Oracle;
  })

  describe("TWAP", async () => {
    it("fetch initial price", async () => {
      const price = new BigNumberJs((await oracle.getTwaPrice(squeethPool, squeeth.address, weth.address, 1)).toString())

      const expectedPrice = new BigNumberJs(squeethPriceInETH)

      expect(price.div(1e18).toFixed(0)).to.be.eq(
        expectedPrice.toFixed(0),
        "initial pool price mismatch"
      );
    })    
  })
})

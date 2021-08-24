import { ethers, getNamedAccounts, deployments } from "hardhat"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signers";
import { expect } from "chai";
import { BigNumber, providers } from "ethers";
import { Oracle, MockWSqueeth } from "../../typechain";
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
import { convertNormalPriceToSqrtX96Price, convertSqrtX96ToEthPrice } from '../calculator'

import { BigNumber as BigNumberJs } from "bignumber.js"

describe("Oracle", function () {
  const squeethPriceInETH = 0.3; // can sell 1 squeeth = 0.3 eth

  let squeeth: MockWSqueeth;
  let oracle: Oracle;
  let provider: providers.JsonRpcProvider;
  let seller1: SignerWithAddress;
  let random: SignerWithAddress;

  let squeethPool: string

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
    const weth = await ethers.getContract("WETH9", deployer);
  
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
      : convertNormalPriceToSqrtX96Price((1 / squeethPriceInETH).toFixed()).toFixed(0)
     

    const token0 = isWethToken0 ? weth.address : squeeth.address
    const token1 = isWethToken0 ? squeeth.address : weth.address
    
    console.log(`sqrtX96Price`, sqrtX96Price)
    console.log(`Human readable price is ${convertSqrtX96ToEthPrice(sqrtX96Price).toString()} eth / squeeth\n`)

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
    const amountIn = new BigNumberJs("1")

    it("fetch initial price", async () => {
      const price = new BigNumberJs((await oracle.getTwaPrice(squeethPool, BigNumber.from("1"))).toString())

      const expectedPrice = new BigNumberJs(0.3)

      expect(price.div(1e18).toFixed(1)).to.be.eq(
        expectedPrice.toFixed(1),
        "initial pool price mismatch"
      );
    })    
  })
})

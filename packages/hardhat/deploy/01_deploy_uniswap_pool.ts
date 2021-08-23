import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

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

import {
  abi as QUOTER_ABI,
  bytecode as QUOTER_BYTECODE,
} from '@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json'

import { convertNormalPriceToSqrtX96Price, convertSqrtX96ToEthPrice } from '../test/calculator'


const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deployer } = await getNamedAccounts();

  const {deploy} = deployments;

  // Deploy WETH9 and UniswapV3Factory for SwapRouter.

  await deploy("WETH9", {
    from: deployer,
    log: true,
  });

  console.log(`WETH9 Deployed 🍇`)

  await deploy("UniswapV3Factory", {
    from: deployer,
    log: true,
    contract: {
      abi: FACTORY_ABI,
      bytecode: FACTORY_BYTECODE
    }
  });
  console.log(`UniswapV3Factory Deployed 🍹`)

  const uniswapFactory = await ethers.getContract("UniswapV3Factory", deployer);
  const weth9 = await ethers.getContract("WETH9", deployer);

  await deploy("SwapRouter", {
    from: deployer,
    log: true,
    contract: {
      abi: SWAP_ROUTER_ABI,
      bytecode: SWAP_ROUTER_BYTECODE
    },
    args: [uniswapFactory.address, weth9.address]
  });
  console.log(`SwapRouter Deployed 🍍`)

  // tokenDescriptor is only used to query tokenURI() on NFT. Don't need that in our deployment
  const tokenDescriptorAddress = ethers.constants.AddressZero

  await deploy("NonfungibleTokenPositionManager", {
    from: deployer,
    log: true,
    contract: {
      abi: POSITION_MANAGER_ABI,
      bytecode: POSITION_MANAGER_BYTECODE,
    },
    args: [uniswapFactory.address, weth9.address, tokenDescriptorAddress]
  });

  console.log(`NonfungibleTokenPositionManager Deployed 🥑\n`)
  const positionManager = await ethers.getContract("NonfungibleTokenPositionManager", deployer);
  
  // Create ETH/SQUEETH Pool with positionManager
  const squeeth = await ethers.getContract("WSqueeth", deployer);
  
  // update this number to initial price we want to start the pool with.
  const price = '0.3'; // can sell 1 squeeth = 0.3 eth
  
  const sqrtX96Price = convertNormalPriceToSqrtX96Price(price).toFixed(0)
  console.log(`sqrtX96Price`, sqrtX96Price)
  console.log(`Human readable price is ${convertSqrtX96ToEthPrice(sqrtX96Price).toString()} eth / squeeth\n`)

  // https://docs.uniswap.org/protocol/reference/periphery/base/PoolInitializer
  await positionManager.createAndInitializePoolIfNecessary(
    weth9.address, // token0
    squeeth.address, // token1
    3000, // fee = 0.3%
    sqrtX96Price
  )

  const pool = await uniswapFactory.getPool(weth9.address, squeeth.address, 3000)
  console.log(`Uniswap Pool created 🐑. Address: ${pool}`)

  await deploy("Quoter", {
    from: deployer,
    log: true,
    contract: {
      abi: QUOTER_ABI,
      bytecode: QUOTER_BYTECODE,
    },
    args: [uniswapFactory.address, weth9.address]
  });

  console.log(`Quoter Deployed  🥦\n`)  
  // next: deploy oracle with the SQUEETH/ETH Pool and ETH/DAI Pool addresses
}

export default func;
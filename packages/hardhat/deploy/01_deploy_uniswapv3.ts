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

import { getWETH, hasUniswapDeployments } from '../tasks/utils'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers, network } = hre;
  const { deployer } = await getNamedAccounts();

  console.log(`Start deploying with ${deployer}`)

  const { deploy } = deployments;

  if (hasUniswapDeployments(network.name)) {
    console.log(`Already have Uniswap Deployment on network ${network.name}. Skipping this step. 🍹\n`)
    return
  } 
  
  console.log(`\nDeploying whole Uniswap 🦄 on network ${network.name} again...`)

  // get WETH9 
  const weth9 = await getWETH(ethers, deployer, network.name)

  // Deploy Uniswap Factory
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

  await deploy("NonfungiblePositionManager", {
    from: deployer,
    log: true,
    contract: {
      abi: POSITION_MANAGER_ABI,
      bytecode: POSITION_MANAGER_BYTECODE,
    },
    args: [uniswapFactory.address, weth9.address, tokenDescriptorAddress]
  });

  console.log(`NonfungiblePositionManager Deployed 🥑\n`)

  const weth = await getWETH(ethers, deployer, network.name)

  await deploy("Quoter", {
    from: deployer,
    log: true,
    contract: {
      abi: QUOTER_ABI,
      bytecode: QUOTER_BYTECODE,
    },
    args: [uniswapFactory.address, weth.address]
  });

  console.log(`Quoter Deployed  🥦\n`) 
  
}

export default func;
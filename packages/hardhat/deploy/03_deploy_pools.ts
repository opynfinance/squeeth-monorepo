import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { createUniPool } from '../test/setup'

import { getDai, getWETH, getUniswapDeployments } from '../tasks/utils'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, ethers, network } = hre;
  const { deployer } = await getNamedAccounts();

  const { positionManager, uniswapFactory } = await getUniswapDeployments(ethers, deployer, network.name)
  
  // Get Tokens
  const weth9 = await getWETH(ethers, deployer, network.name)
  const dai = await getDai(ethers, deployer, network.name);

  // Create ETH/SQUEETH Pool with positionManager
  const squeeth = await ethers.getContract("WSqueeth", deployer);
  
  // update this number to initial price we want to start the pool with.
  
  const squeethPriceInEth = 3000; // can sell 1 squeeth = 0.3 eth
  const squeethWethPool = await createUniPool(squeethPriceInEth, weth9, squeeth, positionManager, uniswapFactory)
  await squeethWethPool.increaseObservationCardinalityNext(128) 

  const ethPriceInDai = 3000
  const ethDaiPool = await createUniPool(ethPriceInDai, dai, weth9, positionManager, uniswapFactory)
  await ethDaiPool.increaseObservationCardinalityNext(128)

  console.log(`SQU/ETH Pool created 🐑. Address: ${squeethWethPool.address}`)
  console.log(`ETH/USD Pool created 🐑. Address: ${ethDaiPool.address}`)
}

export default func;
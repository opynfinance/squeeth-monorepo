import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { createUniPool } from '../test/hardhat-test/setup'

import { getUSDC, getWETH, getUniswapDeployments } from '../tasks/utils'
import { oracleScaleFactor } from '../test/hardhat-test/utils';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, ethers, network } = hre;
  const { deployer } = await getNamedAccounts();

  const { positionManager, uniswapFactory } = await getUniswapDeployments(ethers, deployer, network.name)

  // Get Tokens
  const weth9 = await getWETH(ethers, deployer, network.name)
  const usdc = await getUSDC(ethers, deployer, network.name);

  // Create ETH/SQUEETH Pool with positionManager
  const squeeth = await ethers.getContract("WPowerPerp", deployer);

  // update this number to initial price we want to start the pool with.

  const squeethPriceInEth = 3300 / oracleScaleFactor.toNumber();
  const squeethWethPool = await createUniPool(squeethPriceInEth, weth9, squeeth, positionManager, uniswapFactory)
  const tx1 = await squeethWethPool.increaseObservationCardinalityNext(128)
  await ethers.provider.waitForTransaction(tx1.hash, 1)

  console.log(`SQU/ETH Pool created 🐑. Address: ${squeethWethPool.address}`)

  if (network.name === "mainnet") {
    return
  }
  const ethPriceInDai = 3300
  const ethUSDPool = await createUniPool(ethPriceInDai, usdc, weth9, positionManager, uniswapFactory)
  const tx2 = await ethUSDPool.increaseObservationCardinalityNext(128)
  await ethers.provider.waitForTransaction(tx2.hash, 1)

  console.log(`ETH/USD Pool created 🐑. Address: ${ethUSDPool.address}`)
}

export default func;
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { createUniPool } from '../test/setup'

import { getWETH } from '../tasks/utils'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, ethers, network } = hre;
  const { deployer } = await getNamedAccounts();

  const uniswapFactory = await ethers.getContract("UniswapV3Factory", deployer);
  
  const weth9 = await getWETH(ethers, deployer, network.name)

  const dai = await ethers.getContract("MockErc20", deployer);

  const positionManager = await ethers.getContract("NonfungibleTokenPositionManager", deployer);
  
  // Create ETH/SQUEETH Pool with positionManager
  const squeeth = await ethers.getContract("WSqueeth", deployer);
  
  // update this number to initial price we want to start the pool with.
  
  const squeethPriceInEth = 3000; // can sell 1 squeeth = 0.3 eth
  const squeethWethPool = await createUniPool(squeethPriceInEth, weth9, squeeth, positionManager, uniswapFactory)

  const ethPriceInDai = 3000
  const ethDaiPool = await createUniPool(ethPriceInDai, dai, weth9, positionManager, uniswapFactory)

  console.log(`SQU/ETH Pool created 🐑. Address: ${squeethWethPool.address}`)
  console.log(`ETH/USD Pool created 🐑. Address: ${ethDaiPool.address}`)

}

export default func;
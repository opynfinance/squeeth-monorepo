import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { createUniPool } from '../test/setup'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, ethers } = hre;
  const { deployer } = await getNamedAccounts();

  const uniswapFactory = await ethers.getContract("UniswapV3Factory", deployer);
  const weth9 = await ethers.getContract("WETH9", deployer);
  const dai = await ethers.getContract("MockErc20", deployer);

  const positionManager = await ethers.getContract("NonfungibleTokenPositionManager", deployer);
  
  // Create ETH/SQUEETH Pool with positionManager
  const squeeth = await ethers.getContract("WSqueeth", deployer);
  
  // update this number to initial price we want to start the pool with.
  
  const squeethPriceInEth = 0.3; // can sell 1 squeeth = 0.3 eth
  const squeethWethPool = await createUniPool(squeethPriceInEth, weth9, squeeth, positionManager, uniswapFactory)

  const ethPriceInDai = 0.3
  const ethDaiPool = await createUniPool(ethPriceInDai, dai, weth9, positionManager, uniswapFactory)

  console.log(`SQU/ETH Pool created 🐑. Address: ${squeethWethPool}`)
  console.log(`ETH/USD Pool created 🐑. Address: ${ethDaiPool}`)

}

export default func;
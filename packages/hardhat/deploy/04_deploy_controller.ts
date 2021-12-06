import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import { getPoolAddress } from '../test/setup'
import { getUniswapDeployments, getUSDC, getWETH } from '../tasks/utils'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, ethers, network, deployments } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  // Load contracts
  const oracle = await ethers.getContract("Oracle", deployer);
  const shortSqueeth = await ethers.getContract("ShortPowerPerp", deployer);
  const wsqueeth = await ethers.getContract("WPowerPerp", deployer);
  
  const weth9 = await getWETH(ethers, deployer, network.name)

  const usdc = await getUSDC(ethers, deployer, network.name)

  const { uniswapFactory, positionManager } = await getUniswapDeployments(ethers, deployer, network.name)

  const ethUSDCPool = await getPoolAddress(weth9, usdc, uniswapFactory)
  const squeethEthPool = await getPoolAddress(weth9, wsqueeth, uniswapFactory)

  // deploy controller
  await deploy("Controller", { from: deployer, log: true, args:[oracle.address, shortSqueeth.address, wsqueeth.address, weth9.address, usdc.address,  ethUSDCPool, squeethEthPool, positionManager.address]});
  const controller = await ethers.getContract("Controller", deployer);

  try {
    const tx = await wsqueeth.init(controller.address, { from: deployer });
    await ethers.provider.waitForTransaction(tx.hash, 1)
    console.log(`Squeeth init done 🍋`);
  } catch (error) {
    console.log(`Squeeth already init or wrong deployer address.`)
  }
  
  try {
    const tx = await shortSqueeth.init(controller.address, { from: deployer });
    await ethers.provider.waitForTransaction(tx.hash, 1)
    console.log(`ShortPowerPerp init done 🥭`);
  } catch (error) {
    console.log(`ShortPowerPerp already init or wrong deployer address.`)
  }

  
}

export default func;
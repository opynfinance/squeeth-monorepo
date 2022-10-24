import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { networkNameToWeth, networkNameToUSDC, createArgumentFile } from '../tasks/utils'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers, network } = hre;
  const { deployer } = await getNamedAccounts();
  
  console.log(`Start deploying with ${deployer}`)

  const { deploy } = deployments;

  // if goerli, deploy custom WETH and USDC
  if (network.name === 'goerli') {
    const opynUsdcArgs = ["OpynUSDC", "OpynUSDC", 6]
    const usdc = await deploy("MockErc20", { from: deployer, args: opynUsdcArgs, skipIfAlreadyDeployed: true });
    createArgumentFile('OpynUsdc', network.name, opynUsdcArgs)
    console.log(`OpynUSDC Deployed at ${usdc.address} 🍇`)

    const opynWethArgs = ["OpynWETH", "OpynWETH", 18]
    const weth = await deploy("MockErc20", { from: deployer, args: opynWethArgs, skipIfAlreadyDeployed: true }); 
    createArgumentFile('OpynWeth', network.name, opynWethArgs)
    console.log(`OpynWeth Deployed at ${weth.address} 🍇`)
  }
  else {
    // Deploy WETH9 and UniswapV3Factory for SwapRouter.
    // Deploy WETH9 
    const wethAddr = networkNameToWeth(network.name as string)
    if (wethAddr === undefined) {
      await deploy("WETH9", { from: deployer });
      const weth = await ethers.getContract("WETH9", deployer);
      console.log(`WETH9 Deployed at ${weth.address} 🍇`)
    } else {
      console.log(`Using WETH9 at ${wethAddr}`)
    }

    // Deploy USD
    const usdcAddress = networkNameToUSDC(network.name as string)
    if (usdcAddress === undefined) {
      await deploy("MockErc20", { from: deployer, args: ["USDC", "USDC", 6], skipIfAlreadyDeployed: true });
      const usdc = await ethers.getContract("MockErc20", deployer);
      console.log(`USDC Deployed at ${usdc.address} 🍇`)
    } else {
      console.log(`Using USDC at ${usdcAddress}`)
    }
  }
}

export default func;
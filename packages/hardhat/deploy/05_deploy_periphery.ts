import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getUniswapDeployments, getWETH, createArgumentFile } from '../tasks/utils'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers, network } = hre;
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
    
  const controller = await ethers.getContract("Controller", deployer);
  const weth = await getWETH(ethers, deployer, network.name)
  const { swapRouter } = await getUniswapDeployments(ethers, deployer, network.name)

  const shortHelperArgs = [controller.address, swapRouter.address, weth.address]
  await deploy("ShortHelper", {
    from: deployer,
    log: true,
    args: shortHelperArgs,
    skipIfAlreadyDeployed: true,
  });
  createArgumentFile('ShortHelper', network.name, shortHelperArgs)
  console.log(`Successfully deploy ShortHelper 🥦`)
}

export default func;
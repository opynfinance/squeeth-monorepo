import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import { getUniswapDeployments, getWETH } from '../tasks/utils'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers, network } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const controller = await ethers.getContract("Controller", deployer);
  const weth = await getWETH(ethers, deployer, network.name)

  const {swapRouter} = await getUniswapDeployments(ethers, deployer, network.name)

  console.log("swapRouter.address", swapRouter.address);

  const ShortHelperFactory = await ethers.getContractFactory("ShortHelper", deployer);
  const shortHelperAddress = await ShortHelperFactory.deploy(controller.address, swapRouter.address, weth.address);

  // await deploy("ShortHelper", {
  //   from: deployer,
  //   log: true,
  //   args: [controller.address, swapRouter.address, weth.address]
  // });

  console.log(`Successfully deploy ShortHelper ${shortHelperAddress.address} 🥦`)
}

export default func;
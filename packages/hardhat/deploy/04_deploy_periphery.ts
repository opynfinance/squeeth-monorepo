import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const controller = await ethers.getContract("Controller", deployer);
  const weth = await ethers.getContract("WETH9", deployer);
  const swapRouter = await ethers.getContract("SwapRouter", deployer);

  await deploy("ShortHelper", {
    from: deployer,
    args: [controller.address, swapRouter.address, weth.address]
  });

  console.log(`Successfully deploy ShortHelper 🥦`)
}

export default func;
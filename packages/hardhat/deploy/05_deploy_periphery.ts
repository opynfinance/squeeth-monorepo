import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getUniswapDeployments, getWETH } from '../tasks/utils'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers, network } = hre;
  const { deploy } = deployments;
  if (network.name === "ropsten" || network.name === "mainnet") {
    return
  }

  if (network.name == 'goerli') return;


  const { deployer } = await getNamedAccounts();

  const controller = await ethers.getContract("Controller", deployer);
  const weth = await getWETH(ethers, deployer, network.name)

  const { swapRouter } = await getUniswapDeployments(ethers, deployer, network.name)

  await deploy("ShortHelper", {
    from: deployer,
    log: true,
    args: [controller.address, swapRouter.address, weth.address]
  });

  console.log(`Successfully deploy ShortHelper 🥦`)
}

export default func;
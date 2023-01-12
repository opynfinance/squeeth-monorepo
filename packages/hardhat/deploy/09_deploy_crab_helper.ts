
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { createArgumentFile, getUniswapDeployments} from '../tasks/utils'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers, network } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const { swapRouter } = await getUniswapDeployments(ethers, deployer, network.name)
  const crabV2 = await ethers.getContract("CrabStrategyV2", deployer);


  const args = [crabV2.address, swapRouter.address]

  console.log(crabV2.address, swapRouter.address)


  // Deploy Crabv2 contract
  await deploy("CrabHelper", {
    from: deployer,
    log: true,
    args,
    skipIfAlreadyDeployed: true
  });

  createArgumentFile('CrabHelper', network.name, args)


  console.log(`Successfully deploy CrabOTC`)
}

export default func;
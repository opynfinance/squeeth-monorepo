import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { createArgumentFile, getCrabV2} from '../tasks/utils'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers, network } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const crabV2 = getCrabV2(network.name)

  
  const args = [crabV2]


  // Deploy Crabv2 contract
  await deploy("CrabOTC", {
    from: deployer,
    log: true,
    args,
    skipIfAlreadyDeployed: false
  });

  createArgumentFile('CrabOTC', network.name, args)


  console.log(`Successfully deploy CrabOTC`)
}

export default func;
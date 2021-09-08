import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  await deploy("Oracle", { from: deployer, log: true,});
  await deploy("Controller", { from: deployer, log: true,});
  await deploy("VaultNFTManager", { from: deployer, log: true,});
  await deploy("WSqueeth", { from: deployer, log: true,});
}

export default func;
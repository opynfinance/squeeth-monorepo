import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  await deploy("Oracle", { from: deployer, log: true, skipIfAlreadyDeployed: true });
  await deploy("ShortPowerPerp", { from: deployer, log: true, args: ['short Squeeth', 'sSQTH'], skipIfAlreadyDeployed: true });
  await deploy("WPowerPerp", { from: deployer, log: true, args: ['Opyn Squeeth', 'oSQTH'], skipIfAlreadyDeployed: true });
}

export default func;
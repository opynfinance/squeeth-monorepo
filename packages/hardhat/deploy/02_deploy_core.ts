import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { createArgumentFile } from '../tasks/utils'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  await deploy("Oracle", { from: deployer, log: true, skipIfAlreadyDeployed: true });

  const shortPowerPerpArgs = ['short Squeeth', 'sSQTH']
  await deploy("ShortPowerPerp", { from: deployer, log: true, args: shortPowerPerpArgs, skipIfAlreadyDeployed: true });
  createArgumentFile('ShortPowerPerp', network.name, shortPowerPerpArgs)

  const wPowerPerpArgs = ['Opyn Squeeth', 'oSQTH']
  await deploy("WPowerPerp", { from: deployer, log: true, args: wPowerPerpArgs, skipIfAlreadyDeployed: true });
  createArgumentFile('WPowerPerp', network.name, wPowerPerpArgs)
}

export default func;
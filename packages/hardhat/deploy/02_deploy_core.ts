import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  await deploy("Oracle", { from: deployer, log: true,});
  await deploy("ShortPowerPerp", { from: deployer, log: true, args: ['short Squeeth', 'sSQU']});
  await deploy("WPowerPerp", { from: deployer, log: true, args:['Wrapped Squeeth', 'wSQU']});
}

export default func;
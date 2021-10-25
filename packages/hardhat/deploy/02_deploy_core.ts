import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();
  await deploy("Oracle", { from: deployer, log: true,});
  await deploy("Controller", { from: deployer, log: true,});
  await deploy("ShortPowerPerp", { 
    args: ['Short Squeeth', 'SSQU'],
    from: deployer, 
    log: true
  });
  await deploy("WPowerPerp", { 
    args: ['Wrapped Squeeth', 'WSQU'],
    from: deployer, 
    log: true
  });
}

export default func;
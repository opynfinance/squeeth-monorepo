import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import { getUniswapDeployments, getWETH } from '../tasks/utils'
import { getPoolAddress } from '../test/setup';
import { BigNumber } from 'ethers';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers, network } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  if (network.name === 'hardhat') return;

  // deploy ControllerHelperUtil lib
  await deploy("ControllerHelperUtil", { from: deployer, log: true})
  const controllerHelperUtil = await ethers.getContract("ControllerHelperUtil", deployer)

  const controllerAddress = "0x59F0c781a6eC387F09C40FAA22b7477a2950d209";
  const nftPositionManagerAddress = "0x8c7c1f786da4dee7d4bb49697a9b0c0c8fb328e0";
  const uniswapFactoryAddress = "0xa9C2f675FF8290494675dF5CFc2733319EaeeFDc";
  const aaveAddressProviderAddress = "0x0000000000000000000000000000000000000000";

  // deploy controller helper
  await deploy("ControllerHelper", { from: deployer, log: true, libraries: { ControllerHelperUtil: controllerHelperUtil.address }, args: [controllerAddress, nftPositionManagerAddress, uniswapFactoryAddress, aaveAddressProviderAddress]});
  const controllerHelper = await ethers.getContract("ControllerHelper", deployer);
  
  console.log(`Successfully deploy ControllerHelper ${controllerHelper.address}`)
}

export default func;
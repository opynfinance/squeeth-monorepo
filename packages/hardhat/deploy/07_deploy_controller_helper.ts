import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import { BigNumber } from 'ethers';
import { getUniswapDeployments, getWETH } from '../tasks/utils'
import { getPoolAddress } from '../test/hardhat-test/setup';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers, network } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  if (network.name === 'hardhat') return;

  await deploy("TickMathExternal", { from: deployer, log: true })
  const tickMathExternal = await ethers.getContract("TickMathExternal", deployer)

  await deploy("SqrtPriceMathPartial", { from: deployer, log: true })
  const sqrtPriceMathPartial = await ethers.getContract("SqrtPriceMathPartial", deployer)

  // deploy ControllerHelperUtil lib
  await deploy("ControllerHelperUtil", { from: deployer, log: true, libraries: { TickMathExternal: tickMathExternal.address, SqrtPriceMathPartial: sqrtPriceMathPartial.address }})
  const controllerHelperUtil = await ethers.getContract("ControllerHelperUtil", deployer)

  const controller = await getController(ethers, deployer, network.name);
  console.log("controller", controller.address)
  const { positionManager, uniswapFactory } = await getUniswapDeployments(ethers, deployer, network.name)
  console.log("positionManager", positionManager.address)
  console.log("uniswapFactory", uniswapFactory.address)

  const exec = await getExec(deployer, network.name)
  const euler = await getEuler(deployer, network.name)
  const dWethToken = await getDwethToken(deployer, network.name)
  console.log("exec", exec)
  console.log("euler", euler)
  console.log("dWethToken", dWethToken)

  // deploy controller helper
  await deploy("ControllerHelper", { from: deployer, log: true, libraries: { ControllerHelperUtil: controllerHelperUtil.address }, args: [controller.address, positionManager.address, uniswapFactory.address, exec, euler, dWethToken]});
  const controllerHelper = await ethers.getContract("ControllerHelper", deployer);
  
  console.log(`Successfully deploy ControllerHelper ${controllerHelper.address}`)
}

export default func;
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getCrab, getDwethToken, getEuler, getExec, getUniswapDeployments, getWETH } from '../tasks/utils'
import { getPoolAddress } from '../test/setup';
import { one } from '../test/utils';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers, network } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const controller = await ethers.getContract("Controller", deployer);
  const oracle = await ethers.getContract("Oracle", deployer);
  const weth = await getWETH(ethers, deployer, network.name)
  const wsqueeth = await ethers.getContract("WPowerPerp", deployer);
  const crabV1 = getCrab(network.name);

  const { uniswapFactory, } = await getUniswapDeployments(ethers, deployer, network.name)

  const squeethPoolAddr = await getPoolAddress(wsqueeth, weth, uniswapFactory)


  if (network.name === "mainnet") {
    return
  }


  const exec = await getExec(deployer, network.name)
  const euler = await getEuler(deployer, network.name)
  const dWethToken = await getDwethToken(deployer, network.name)

  // Deploy CrabMigration contract
  await deploy("CrabMigration", {
    from: deployer,
    log: true,
    args: [
      crabV1,
      weth.address,
      exec,
      dWethToken,
      euler,
    ],
    skipIfAlreadyDeployed: true
  });

  console.log(`Successfully deploy CrabMigration`)

  // Deploy Timelock contract
  await deploy("Timelock", {
    from: deployer,
    log: true,
    args: [
      deployer,
      172800,
    ],
    skipIfAlreadyDeployed: true
  });

  console.log(`Successfully deploy Timelock`)

  const timelock = await ethers.getContract("Timelock", deployer);
  const migration = await ethers.getContract("CrabMigration", deployer);

  console.log(crabV1, controller.address, oracle.address, weth.address, uniswapFactory.address, squeethPoolAddr, timelock.address, migration.address, 1, one.toString())

  // Deploy Crabv2 contract
  await deploy("CrabStrategyV2", {
    from: deployer,
    log: true,
    args: [
      controller.address,
      oracle.address,
      weth.address,
      uniswapFactory.address,
      squeethPoolAddr,
      timelock.address,
      migration.address,
      1,
      one
    ],
    skipIfAlreadyDeployed: true
  });

  console.log(`Successfully deploy CrabStrategyV2`)
}

export default func;
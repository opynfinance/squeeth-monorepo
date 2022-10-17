import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import { getUniswapDeployments, getWETH, createArgumentFile } from '../tasks/utils'
import { getPoolAddress } from '../test/setup';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers, network } = hre;
  const { deploy } = deployments;
    
  const { deployer } = await getNamedAccounts();
  if (network.name === 'mainnet') return

  const controller = await ethers.getContract("Controller", deployer);
  const oracle = await ethers.getContract("Oracle", deployer);
  const weth = await getWETH(ethers, deployer, network.name)
  const wsqueeth = await ethers.getContract("WPowerPerp", deployer);
  const { uniswapFactory } = await getUniswapDeployments(ethers, deployer, network.name)
  const squeethPoolAddr = await getPoolAddress(wsqueeth, weth, uniswapFactory)

  // strategy parameters
  const hedgeTimeThreshold = 86400
  const hedgePriceThreshold = ethers.utils.parseUnits('0.01')
  const auctionTime = 3600
  const minPriceMultiplier = ethers.utils.parseUnits('0.95')
  const maxPriceMultiplier = ethers.utils.parseUnits('1.05')

  // so this won't affect our deployment in test files
  const crabStrategyArgs = [
    controller.address,
    oracle.address,
    weth.address,
    uniswapFactory.address,
    squeethPoolAddr,
    hedgeTimeThreshold,
    hedgePriceThreshold,
    auctionTime,
    minPriceMultiplier,
    maxPriceMultiplier
  ]
  await deploy("CrabStrategyDeployment", {
    contract: "CrabStrategy",
    from: deployer,
    log: true,
    args: crabStrategyArgs,
    gasLimit: 10000000,
    skipIfAlreadyDeployed: true,
  });
  createArgumentFile('CrabStrategy', network.name, crabStrategyArgs)

  console.log(`Successfully deploy CrabStrategy`)
}

export default func;
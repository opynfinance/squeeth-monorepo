import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';
import { getUniswapDeployments, getWETH } from '../tasks/utils'
import { getPoolAddress } from '../test/hardhat-test/setup';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers, network } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  const controller = await ethers.getContract("Controller", deployer);
  const oracle = await ethers.getContract("Oracle", deployer);
  const weth = await getWETH(ethers, deployer, network.name)
  const wsqueeth = await ethers.getContract("WPowerPerp", deployer);

  const {uniswapFactory} = await getUniswapDeployments(ethers, deployer, network.name)

  const squeethPoolAddr = await getPoolAddress(wsqueeth, weth, uniswapFactory)
  
  if (network.name === "mainnet") {
    return
  }

  // strategy parameters
  const hedgeTimeThreshold = 86400
  const hedgePriceThreshold = ethers.utils.parseUnits('0.01')
  const auctionTime = 3600
  const minPriceMultiplier = ethers.utils.parseUnits('0.95')
  const maxPriceMultiplier = ethers.utils.parseUnits('1.05')

  // so this won't affect our deployment in test files
  await deploy("CrabStrategyDeployment", {
    contract: "CrabStrategy",
    from: deployer,
    log: true,
    args: [
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
  });

  console.log(`Successfully deploy CrabStrategy`)
}

export default func;
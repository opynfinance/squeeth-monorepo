import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import { getPoolAddress } from '../test/setup'
import { getUniswapDeployments, getWETH } from '../tasks/utils'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, ethers, network } = hre;
  const { deployer } = await getNamedAccounts();

  // Load contracts
  const oracle = await ethers.getContract("Oracle", deployer);
  const controller = await ethers.getContract("Controller", deployer);
  const vaultNft = await ethers.getContract("VaultNFTManager", deployer);
  const wsqueeth = await ethers.getContract("WSqueeth", deployer);
  
  const weth9 = await getWETH(ethers, deployer, network.name)

  const dai = await ethers.getContract("MockErc20", deployer);

  const { uniswapFactory, positionManager } = await getUniswapDeployments(ethers, deployer, network.name)

  const ethDaiPool = await getPoolAddress(weth9, dai, uniswapFactory)
  const squeethEthPool = await getPoolAddress(weth9, wsqueeth, uniswapFactory)

  try {
    const tx = await controller.init(oracle.address, vaultNft.address, wsqueeth.address, weth9.address, dai.address,  ethDaiPool, squeethEthPool, positionManager.address, { from: deployer });
    await ethers.provider.waitForTransaction(tx.hash, 1)
    console.log(`Controller init done 🥝`);
  } catch (error) {
    console.log(`Controller already init or encountered error`)
  }

  try {
    const tx = await wsqueeth.init(controller.address, { from: deployer });
    await ethers.provider.waitForTransaction(tx.hash, 1)
    console.log(`Squeeth init done 🍋`);
  } catch (error) {
    console.log(`Squeeth already init.`)
  }
  
  try {
    const tx = await vaultNft.init(controller.address, { from: deployer });
    await ethers.provider.waitForTransaction(tx.hash, 1)
    console.log(`VaultNFTManager init done 🥭`);
  } catch (error) {
    console.log(`VaultNFTManager already init.`)
  }

  
}

export default func;
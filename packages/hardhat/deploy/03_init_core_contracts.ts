import {HardhatRuntimeEnvironment} from 'hardhat/types';
import {DeployFunction} from 'hardhat-deploy/types';

import { getPoolAddress } from '../test/setup'
import { getWETH } from '../tasks/utils'

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
  const uniswapFactory = await ethers.getContract("UniswapV3Factory", deployer);

  const ethDaiPool = await getPoolAddress(weth9, dai, uniswapFactory)
  const squeethEthPool = await getPoolAddress(weth9, wsqueeth, uniswapFactory)

  try {
    await controller.init(oracle.address, vaultNft.address, wsqueeth.address, weth9.address, dai.address,  ethDaiPool, squeethEthPool, { from: deployer });
    console.log(`Controller init done 🥝`);
  } catch (error) {
    console.log(`Controller already init.`)
  }

  try {
    await wsqueeth.init(controller.address, { from: deployer });
    console.log(`Squeeth init done 🍋`);
  } catch (error) {
    console.log(`Squeeth already init.`)
  }
  
  try {
    await vaultNft.init(controller.address, { from: deployer });
    console.log(`VaultNFTManager init done 🥭`);
  } catch (error) {
    console.log(`VaultNFTManager already init.`)
  }

  
}

export default func;
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { networkNameToWeth, networkNameToDai } from '../tasks/utils'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, ethers, network } = hre;
  const { deployer } = await getNamedAccounts();

  console.log(`Start deploying with ${deployer}`)

  const {deploy} = deployments;
  // Deploy WETH9 and UniswapV3Factory for SwapRouter.

  // Deploy WETH9 
  const wethAddr = networkNameToWeth(network.name as string)
  if (wethAddr === undefined) {
    await deploy("WETH9", { from: deployer });
    const weth = await ethers.getContract("WETH9", deployer);
    console.log(`WETH9 Deployed at ${weth.address} 🍇`)
  } else {
    console.log(`Using WETH9 at ${wethAddr}`)
  }

  // Deploy Dai
  const daiAddr = networkNameToDai(network.name as string)
  if (daiAddr === undefined) {
    await deploy("MockErc20", { from: deployer, args: ["DAI", "DAI"], skipIfAlreadyDeployed: false });  
    const dai = await ethers.getContract("MockErc20", deployer);
    console.log(`Dai Deployed at ${dai.address} 🍇`)
  } else {
    console.log(`Using Dai at ${daiAddr}`)
  }
}

export default func;
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

import { getPoolAddress } from '../test/hardhat-test/setup'
import { getUniswapDeployments, getUSDC, getWETH } from '../tasks/utils'

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { getNamedAccounts, ethers, network, deployments } = hre;
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  const feeTier = 3000

  // Load contracts
  const oracle = await ethers.getContract("Oracle", deployer);
  const shortSqueeth = await ethers.getContract("ShortPowerPerp", deployer);
  const wsqueeth = await ethers.getContract("WPowerPerp", deployer);

  const weth9 = await getWETH(ethers, deployer, network.name)

  const usdc = await getUSDC(ethers, deployer, network.name)

  const { uniswapFactory, positionManager } = await getUniswapDeployments(ethers, deployer, network.name)

  const ethUSDCPool = await getPoolAddress(weth9, usdc, uniswapFactory)
  const squeethEthPool = await getPoolAddress(weth9, wsqueeth, uniswapFactory)

  // deploy abdk library
  await deploy("ABDKMath64x64", { from: deployer, log: true })
  const abdk = await ethers.getContract("ABDKMath64x64", deployer)

  await deploy("TickMathExternal", { from: deployer, log: true })
  const tickMathExternal = await ethers.getContract("TickMathExternal", deployer)

  await deploy("SqrtPriceMathPartial", { from: deployer, log: true })
  const sqrtPriceMathPartial = await ethers.getContract("SqrtPriceMathPartial", deployer)

  // deploy controller
  await deploy("Controller", { from: deployer, log: true, libraries: { ABDKMath64x64: abdk.address, SqrtPriceMathPartial: sqrtPriceMathPartial.address, TickMathExternal: tickMathExternal.address }, args: [oracle.address, shortSqueeth.address, wsqueeth.address, weth9.address, usdc.address, ethUSDCPool, squeethEthPool, positionManager.address, feeTier] });
  const controller = await ethers.getContract("Controller", deployer);

  try {
    const tx = await wsqueeth.init(controller.address, { from: deployer });
    await ethers.provider.waitForTransaction(tx.hash, 1)
    console.log(`Squeeth init done 🍋`);
  } catch (error) {
    console.log(`Squeeth already init or wrong deployer address.`)
  }

  try {
    const tx = await shortSqueeth.init(controller.address, { from: deployer });
    await ethers.provider.waitForTransaction(tx.hash, 1)
    console.log(`ShortPowerPerp init done 🥭`);
  } catch (error) {
    console.log(`ShortPowerPerp already init or wrong deployer address.`)
  }

  const alsig = "0x0144571202B48d8B3EEE3A95E4140B7144F8b72F"

  if (network.name === "mainnet") {
    try {
      const tx = await controller.transferOwnership(alsig, { from: deployer });
      await ethers.provider.waitForTransaction(tx.hash, 1)
      console.log(`Ownership transferred! 🥭`);
    } catch (error) {
      console.log(`Ownership transfer failed`)
    }
  }

}

export default func;
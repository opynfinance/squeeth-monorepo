import { ethers, getNamedAccounts, deployments } from "hardhat"

import { Contract } from "ethers";

import {
  abi as SWAP_ROUTER_ABI,
  bytecode as SWAP_ROUTER_BYTECODE,
} from '@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json'
import {
  abi as POSITION_MANAGER_ABI,
  bytecode as POSITION_MANAGER_BYTECODE,
} from '@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json'
import {
  abi as FACTORY_ABI,
  bytecode as FACTORY_BYTECODE,
} from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json'
import { Controller, VaultNFTManager, WETH9, WSqueeth } from "../typechain";
import { convertNormalPriceToSqrtX96Price } from "./calculator";



/**
 * Deploy Uniswap factory, swapRouter, nftPositionManager and WETH9
 * @returns 
 */
export const deployUniswapV3 = async() => {
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  await deploy("UniswapV3Factory", {
    from: deployer,
    contract: {
      abi: FACTORY_ABI,
      bytecode: FACTORY_BYTECODE
    }
  });
  const uniswapFactory = await ethers.getContract("UniswapV3Factory", deployer);

  await deploy("WETH9", { from: deployer });
  const weth = await ethers.getContract("WETH9", deployer) as WETH9;

  await deploy("SwapRouter", {
    from: deployer,
    contract: {
      abi: SWAP_ROUTER_ABI,
      bytecode: SWAP_ROUTER_BYTECODE
    },
    args: [uniswapFactory.address, weth.address]
  });

  const swapRouter = await ethers.getContract("SwapRouter", deployer);

  // tokenDescriptor is only used to query tokenURI() on NFT. Don't need that in our deployment
  const tokenDescriptorAddress = ethers.constants.AddressZero
  await deploy("NonfungibleTokenPositionManager", {
    from: deployer,
    contract: {
      abi: POSITION_MANAGER_ABI,
      bytecode: POSITION_MANAGER_BYTECODE,
    },
    args: [uniswapFactory.address, weth.address, tokenDescriptorAddress]
  });
  const positionManager = await ethers.getContract("NonfungibleTokenPositionManager", deployer);

  return { positionManager, uniswapFactory, weth, swapRouter }
}

/**
 * Deploy controller, squeeth token and vaultNFT
 * @returns 
 */
export const deploySqueethCoreContracts= async() => {
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;
  await deploy("Controller", { from: deployer });

  await deploy("VaultNFTManager", { from: deployer });

  await deploy("WSqueeth", { from: deployer });

  const controller = await ethers.getContract("Controller", deployer) as  Controller;
  const vaultNft = await ethers.getContract("VaultNFTManager", deployer) as VaultNFTManager;
  const squeeth = await ethers.getContract("WSqueeth", deployer) as WSqueeth;

  await controller.init(vaultNft.address, squeeth.address, { from: deployer });
  await squeeth.init(controller.address, { from: deployer });
  await vaultNft.init(controller.address, { from: deployer });

  return { controller, squeeth, vaultNft }
}

export const createPoolAndAddLiquidity = async(
  squeethPriceInETH: number, 
  initLiquiditySqueethAmount: string, 
  collateralAmount: string,
  deployer: string,
  squeeth: WSqueeth, 
  weth: WETH9,
  positionManager: Contract,
  controller: Controller,
  univ3Factory: Contract,
  ) => {

    const isWethToken0 = parseInt(weth.address, 16) < parseInt(squeeth.address, 16)

    const sqrtX96Price = isWethToken0 
      ? convertNormalPriceToSqrtX96Price(squeethPriceInETH.toString()).toFixed(0)
      : convertNormalPriceToSqrtX96Price((1 / squeethPriceInETH).toFixed()).toFixed(0)
     

    const token0 = isWethToken0 ? weth.address : squeeth.address
    const token1 = isWethToken0 ? squeeth.address : weth.address

    await positionManager.createAndInitializePoolIfNecessary(
      token0,
      token1,
      3000, // fee = 0.3%
      sqrtX96Price
    )
    
    const liquiditySqueethAmount = ethers.utils.parseEther(initLiquiditySqueethAmount) 
    const wethAmount = parseFloat(initLiquiditySqueethAmount) * squeethPriceInETH
    const liquidityWethAmount = ethers.utils.parseEther(wethAmount.toString()) 

    let squeethBalance = await squeeth.balanceOf(deployer)
    let wethBalance = await weth.balanceOf(deployer)

    if (wethBalance.lt(liquidityWethAmount)) {
      await weth.deposit({value: liquidityWethAmount, from: deployer})
      wethBalance = await weth.balanceOf(deployer)
    }
  
    if (squeethBalance.lt(liquiditySqueethAmount)) {
      // use {collateralAmount} eth to mint squeeth
      await controller.mint(0, liquiditySqueethAmount, {value: ethers.utils.parseEther(collateralAmount)}) 
      squeethBalance = await squeeth.balanceOf(deployer)
    }

    await weth.approve(positionManager.address, ethers.constants.MaxUint256)
    await squeeth.approve(positionManager.address, ethers.constants.MaxUint256)
    
    const mintParam = {
      token0,
      token1,
      fee: 3000,
      tickLower: -887220,// int24 min tick used when selecting full range
      tickUpper: 887220,// int24 max tick used when selecting full range
      amount0Desired: isWethToken0 ? liquidityWethAmount : liquiditySqueethAmount,
      amount1Desired: isWethToken0 ? liquiditySqueethAmount : liquidityWethAmount,
      amount0Min: 0,
      amount1Min: 0,
      recipient: deployer,// address
      deadline: Math.floor(Date.now() / 1000 + 86400),// uint256
    }

    await positionManager.mint(mintParam)

    const pool = await univ3Factory.getPool(token0, token1, 3000)
    return pool
}
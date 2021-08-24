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
import { Controller, Oracle, VaultNFTManager, WETH9, WSqueeth, MockErc20 } from "../typechain";
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
  await deploy("Oracle", { from: deployer });
  await deploy("VaultNFTManager", { from: deployer });
  await deploy("WSqueeth", { from: deployer });
  await deploy("MockErc20", { from: deployer, args: ["DAI", "DAI"] });

  const controller = await ethers.getContract("Controller", deployer) as  Controller;
  const oracle = await ethers.getContract("Oracle", deployer) as  Oracle;
  const vaultNft = await ethers.getContract("VaultNFTManager", deployer) as VaultNFTManager;
  const squeeth = await ethers.getContract("WSqueeth", deployer) as WSqueeth;
  const dai = await ethers.getContract("MockErc20", deployer) as MockErc20;

  const uniDeployments = await deployUniswapV3()
  const uniWsqueethPool = await createUniPool(0.3, squeeth, uniDeployments.weth, uniDeployments.positionManager, uniDeployments.uniswapFactory)
  const ethUsdPool = await createUniPool(0.3, dai, uniDeployments.weth, uniDeployments.positionManager, uniDeployments.uniswapFactory)

  await controller.init(oracle.address, vaultNft.address, squeeth.address, ethUsdPool, uniWsqueethPool, { from: deployer });
  await squeeth.init(controller.address, { from: deployer });
  await vaultNft.init(controller.address, { from: deployer });

  return { controller, squeeth, vaultNft }
}

export const createUniPool = async(
  tokenPriceInEth: number, 
  token0: Contract, 
  token1: Contract,
  positionManager: Contract,
  univ3Factory: Contract
) => {
  const isWethToken0 = parseInt(token1.address, 16) < parseInt(token0.address, 16)

  const sqrtX96Price = isWethToken0 
    ? convertNormalPriceToSqrtX96Price(tokenPriceInEth.toString()).toFixed(0)
    : convertNormalPriceToSqrtX96Price((1 / tokenPriceInEth).toFixed()).toFixed(0)
   

  const token0Add = isWethToken0 ? token1.address : token0.address
  const token1Add = isWethToken0 ? token0.address : token1.address

  await positionManager.createAndInitializePoolIfNecessary(
    token0Add,
    token1Add,
    3000, // fee = 0.3%
    sqrtX96Price
  )

  const pool = await univ3Factory.getPool(token0Add, token1Add, 3000)
  return pool
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
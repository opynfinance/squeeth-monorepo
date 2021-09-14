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
import { Controller, Oracle, VaultNFTManager, WETH9, WSqueeth, MockErc20, INonfungiblePositionManager } from "../typechain";
import { convertToken0PriceToSqrtX96Price, convertToken1PriceToSqrtX96Price } from "./calculator";



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
 * Create uniswap pool.
 * @param tokenBPriceInA 
 * @param tokenA 
 * @param tokenB 
 * @param positionManager 
 * @param univ3Factory 
 * @returns {Contract}
 */
export const createUniPool = async(
  tokenBPriceInA: number, 
  tokenA: Contract, 
  tokenB: Contract,
  positionManager: Contract,
  univ3Factory: Contract
): Promise<Contract> => {
  const isTokenAToken0 = parseInt(tokenA.address, 16) < parseInt(tokenB.address, 16)

  const sqrtX96Price = isTokenAToken0 
    ? convertToken1PriceToSqrtX96Price(tokenBPriceInA.toString()).toFixed(0)
    : convertToken0PriceToSqrtX96Price(tokenBPriceInA.toString()).toFixed(0)

  const token0Addr = isTokenAToken0 ? tokenA.address : tokenB.address
  const token1Addr = isTokenAToken0 ? tokenB.address : tokenA.address
  
  const poolAddrFirstTry = await univ3Factory.getPool(token0Addr, token1Addr, 3000)
  if (poolAddrFirstTry !== ethers.constants.AddressZero) {
    return ethers.getContractAt("IUniswapV3Pool", poolAddrFirstTry);
  }

  await positionManager.createAndInitializePoolIfNecessary(
    token0Addr,
    token1Addr,
    3000, // fee = 0.3%
    sqrtX96Price
  )

  // avoid poolAddr being address(0) because requested too fast after last transaction. 
  let poolAddr: string 
  while(true) {
    await delay(5000)
    poolAddr = await univ3Factory.getPool(token0Addr, token1Addr, 3000)
    if (poolAddr !== ethers.constants.AddressZero) break;
  }

  const pool = await ethers.getContractAt("IUniswapV3Pool", poolAddr);

  return pool
}

/**
 * Get pool address, given 2 tokens
 * @param tokenA 
 * @param tokenB 
 * @param univ3Factory 
 * @returns 
 */
export const getPoolAddress = async (
  tokenA: Contract, 
  tokenB: Contract,
  univ3Factory: Contract
) => {
  const isTokenAToken0 = parseInt(tokenA.address, 16) < parseInt(tokenB.address, 16)

  const token0Addr = isTokenAToken0 ? tokenA.address : tokenB.address
  const token1Addr = isTokenAToken0 ? tokenB.address : tokenA.address
  const poolAddr = await univ3Factory.getPool(token0Addr, token1Addr, 3000)
  return poolAddr as string
} 

/**
 * Deploy controller, squeeth token and vaultNFT
 * @returns 
 */
 export const deploySqueethCoreContracts= async(weth: Contract, positionManager: Contract, uniswapFactory: Contract, wsqueethEthPrice?: number, ethDaiPrice?: number ) => {
  const { deployer } = await getNamedAccounts();
  const { deploy } = deployments;

  const res = await deploy("Controller", { from: deployer, skipIfAlreadyDeployed: false });
  await deploy("Oracle", { from: deployer, skipIfAlreadyDeployed: false });
  await deploy("VaultNFTManager", { from: deployer, skipIfAlreadyDeployed: false });
  await deploy("WSqueeth", { from: deployer, skipIfAlreadyDeployed: false });
  await deploy("MockErc20", { from: deployer, args: ["DAI", "DAI"], skipIfAlreadyDeployed: false });

  const controller = await ethers.getContract("Controller", deployer) as  Controller;
  const oracle = await ethers.getContract("Oracle", deployer) as  Oracle;
  const vaultNft = await ethers.getContract("VaultNFTManager", deployer) as VaultNFTManager;
  const squeeth = await ethers.getContract("WSqueeth", deployer) as WSqueeth;
  const dai = await ethers.getContract("MockErc20", deployer) as MockErc20;

  // 1 squeeth is 3000 eth
  const squeethPriceInEth = wsqueethEthPrice || 3000
  const wsqueethEthPool = await createUniPool(squeethPriceInEth, weth, squeeth, positionManager, uniswapFactory) as Contract
  // 1 weth is 3000 dai
  const ethPriceInDai = ethDaiPrice || 3000
  const ethDaiPool = await createUniPool(ethPriceInDai, dai, weth, positionManager, uniswapFactory) as Contract

  await wsqueethEthPool.increaseObservationCardinalityNext(128) 
  await ethDaiPool.increaseObservationCardinalityNext(128) 

  if (res.newlyDeployed) {
    await controller.init(
      oracle.address, 
      vaultNft.address, 
      squeeth.address,
      weth.address, 
      dai.address, 
      ethDaiPool.address, 
      wsqueethEthPool.address, 
      positionManager.address,
      { from: deployer }
    );
    await squeeth.init(controller.address, { from: deployer });
    await vaultNft.init(controller.address, { from: deployer });
  }
  
  return { controller, squeeth, vaultNft, ethDaiPool, wsqueethEthPool, dai }
}

export const addLiquidity = async(
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

    const token0 = isWethToken0 ? weth.address : squeeth.address
    const token1 = isWethToken0 ? squeeth.address : weth.address
    
    const liquiditySqueethAmount = ethers.utils.parseEther(initLiquiditySqueethAmount) 
    const wethAmount = parseFloat(initLiquiditySqueethAmount) * squeethPriceInETH
    const liquidityWethAmount = ethers.utils.parseEther(wethAmount.toString()) 

    let wsqueethBalance = await squeeth.balanceOf(deployer)
    let wethBalance = await weth.balanceOf(deployer)

    if (wethBalance.lt(liquidityWethAmount)) {
      await weth.deposit({value: liquidityWethAmount, from: deployer})
      wethBalance = await weth.balanceOf(deployer)
    }
  
    if (wsqueethBalance.lt(liquiditySqueethAmount)) {
      // use {collateralAmount} eth to mint squeeth
      await controller.mint(0, liquiditySqueethAmount.sub(wsqueethBalance), 0, {value: ethers.utils.parseEther(collateralAmount)}) 
      wsqueethBalance = await squeeth.balanceOf(deployer)
    }

    
    await weth.approve(positionManager.address, ethers.constants.MaxUint256)
    await squeeth.approve(positionManager.address, ethers.constants.MaxUint256)
    
    const liquidityWSqueethAmount = wsqueethBalance

    const mintParam = {
      token0,
      token1,
      fee: 3000,
      tickLower: -887220,// int24 min tick used when selecting full range
      tickUpper: 887220,// int24 max tick used when selecting full range
      amount0Desired: isWethToken0 ? liquidityWethAmount : liquidityWSqueethAmount,
      amount1Desired: isWethToken0 ? liquidityWSqueethAmount : liquidityWethAmount,
      amount0Min: 1,
      amount1Min: 1,
      recipient: deployer,// address
      deadline: Math.floor(Date.now() / 1000 + 86400),// uint256
    }

    await (positionManager as INonfungiblePositionManager).mint(mintParam)

    const pool = await univ3Factory.getPool(token0, token1, 3000)
    return pool
}

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}
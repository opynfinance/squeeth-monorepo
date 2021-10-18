import { ethers } from "hardhat"
import { Contract, BigNumber } from "ethers";
import { BigNumber as BigNumberJs} from "bignumber.js"

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

export const deployWETHAndDai = async() => {
  const MockErc20Contract = await ethers.getContractFactory("MockErc20");
  const dai = (await MockErc20Contract.deploy("Dai", "Dai")) as MockErc20;

  const WETH9Contract = await ethers.getContractFactory("WETH9");
  const weth = (await WETH9Contract.deploy()) as WETH9;

  return { dai, weth }
}

/**
 * Deploy Uniswap factory, swapRouter, nftPositionManager and WETH9
 * @returns 
 */
export const deployUniswapV3 = async(weth: Contract) => {
  const accounts = await ethers.getSigners();
  
  // Deploy UniswapV3Factory
  const UniswapV3FactoryFactory = new ethers.ContractFactory(FACTORY_ABI, FACTORY_BYTECODE, accounts[0]);
  const uniswapFactory = await UniswapV3FactoryFactory.deploy();

  // Deploy UniswapV3SwapRouter
  const SwapRouterFactory = new ethers.ContractFactory(SWAP_ROUTER_ABI, SWAP_ROUTER_BYTECODE, accounts[0]);
  const swapRouter = await SwapRouterFactory.deploy(uniswapFactory.address, weth.address);

  // tokenDescriptor is only used to query tokenURI() on NFT. Don't need that in our deployment
  const tokenDescriptorAddress = ethers.constants.AddressZero
  // Deploy NonfungibleTokenManager
  const positionManagerFactory = new ethers.ContractFactory(POSITION_MANAGER_ABI, POSITION_MANAGER_BYTECODE, accounts[0]);
  const positionManager = await positionManagerFactory.deploy(uniswapFactory.address, weth.address, tokenDescriptorAddress);

  return { positionManager, uniswapFactory, swapRouter }
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
 export const deploySqueethCoreContracts= async(weth: Contract, dai: Contract, positionManager: Contract, uniswapFactory: Contract, wsqueethEthPrice?: number, ethDaiPrice?: number ) => {
  // const { deployer } = await getNamedAccounts();

  const ControllerContract = await ethers.getContractFactory("Controller");
  const controller = (await ControllerContract.deploy()) as Controller;

  const OracleContract = await ethers.getContractFactory("Oracle");
  const oracle = (await OracleContract.deploy()) as Oracle;

  const NFTContract = await ethers.getContractFactory("VaultNFTManager");
  const vaultNft = (await NFTContract.deploy()) as VaultNFTManager;

  const WSqueethContract = await ethers.getContractFactory("WSqueeth");
  const squeeth = (await WSqueethContract.deploy()) as WSqueeth;

  // 1 squeeth is 3000 eth
  const squeethPriceInEth = wsqueethEthPrice || 3000
  const wsqueethEthPool = await createUniPool(squeethPriceInEth, weth, squeeth, positionManager, uniswapFactory) as Contract
  // 1 weth is 3000 dai
  const ethPriceInDai = ethDaiPrice || 3000
  const ethDaiPool = await createUniPool(ethPriceInDai, dai, weth, positionManager, uniswapFactory) as Contract

  await wsqueethEthPool.increaseObservationCardinalityNext(128) 
  await ethDaiPool.increaseObservationCardinalityNext(128) 

  await controller.init(
    oracle.address, 
    vaultNft.address, 
    squeeth.address,
    weth.address, 
    dai.address, 
    ethDaiPool.address, 
    wsqueethEthPool.address, 
    positionManager.address,
  );
  await squeeth.init(controller.address);
  await vaultNft.init(controller.address);
  
  return { controller, squeeth, vaultNft, ethDaiPool, wsqueethEthPool, oracle }
}

export const addSqueethLiquidity = async(
  squeethPriceInETH: number, 
  initLiquiditySqueethAmount: string, 
  collateralAmount: string,
  deployer: string,
  squeeth: WSqueeth, 
  weth: WETH9,
  positionManager: Contract,
  controller: Controller
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
      await controller.mintWPowerPerpAmount(0, liquiditySqueethAmount.sub(wsqueethBalance), 0, {value: ethers.utils.parseEther(collateralAmount)}) 
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

    const tx = await (positionManager as INonfungiblePositionManager).mint(mintParam)
    const receipt = await tx.wait();
    const tokenId : BigNumber = (receipt.events?.find(event => event.event === 'IncreaseLiquidity'))?.args?.tokenId;

    return tokenId.toNumber()
}

export const addWethDaiLiquidity = async(
  ethPrice: number, 
  ethAmount: BigNumber, 
  deployer: string,
  dai: MockErc20, 
  weth: WETH9,
  positionManager: Contract
  ) => {

    const isWethToken0 = parseInt(weth.address, 16) < parseInt(dai.address, 16)

    const token0 = isWethToken0 ? weth.address : dai.address
    const token1 = isWethToken0 ? dai.address : weth.address
    
    const daiAmount = new BigNumberJs(ethAmount.toString()).multipliedBy(ethPrice)
    
    const daiBalance = new BigNumberJs((await dai.balanceOf(deployer)).toString())
    const wethBalance = new BigNumberJs((await weth.balanceOf(deployer)).toString())

    if (wethBalance.isLessThan(ethAmount.toString())) {
      await weth.deposit({value: ethAmount.toString(), from: deployer})
    }
  
    if (daiBalance.lt(daiAmount)) {
      await dai.mint(deployer,daiAmount.toString() ) 
    }

    await dai.approve(positionManager.address, ethers.constants.MaxUint256)
    await weth.approve(positionManager.address, ethers.constants.MaxUint256)
    
    const mintParam = {
      token0,
      token1,
      fee: 3000,
      tickLower: -887220,// int24 min tick used when selecting full range
      tickUpper: 887220,// int24 max tick used when selecting full range
      amount0Desired: isWethToken0 ? ethAmount.toString() : daiAmount.toString(),
      amount1Desired: isWethToken0 ? daiAmount.toString() : ethAmount.toString(),
      amount0Min: 1,
      amount1Min: 1,
      recipient: deployer,// address
      deadline: Math.floor(Date.now() / 1000 + 86400),// uint256
    }

    const tx = await (positionManager as INonfungiblePositionManager).mint(mintParam)
    const receipt = await tx.wait();
    const tokenId : BigNumber = (receipt.events?.find(event => event.event === 'IncreaseLiquidity'))?.args?.tokenId;

    return tokenId.toNumber()
}

export const removeAllLiquidity = async(tokenId: number, positionManager: any) => {
  const res = await positionManager.positions(tokenId)
  const liquidity = res.liquidity as BigNumber
  const burnParam = {
    tokenId,
    liquidity,
    amount0Min: 0,
    amount1Min: 0,
    deadline: Math.floor(Date.now() / 1000 + 86400)
  }
  await (positionManager as INonfungiblePositionManager).decreaseLiquidity(burnParam)
}

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}
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
import {
  abi as QUOTER_ABI,
  bytecode as QUOTER_BYTECODE,
} from "@uniswap/v3-periphery/artifacts/contracts/lens/Quoter.sol/Quoter.json"
import { Controller, Oracle, ShortPowerPerp, WETH9, WPowerPerp, MockErc20, INonfungiblePositionManager, ABDKMath64x64 } from "../../../typechain";
import { convertToken0PriceToSqrtX96Price, convertToken1PriceToSqrtX96Price } from "./calculator";
import { getNow } from './utils'

export const deployWETHAndDai = async() => {
  const MockErc20Contract = await ethers.getContractFactory("MockErc20");
  const dai = (await MockErc20Contract.deploy("Dai", "Dai", 18)) as MockErc20;

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

  const quoterFactory = new ethers.ContractFactory(QUOTER_ABI, QUOTER_BYTECODE, accounts[0]);
  const quoter = await quoterFactory.deploy(uniswapFactory.address, weth.address);


  return { positionManager, uniswapFactory, swapRouter, quoter }
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
  univ3Factory: Contract,
  feeTier = 3000 // default fee = 0.3%
): Promise<Contract> => {
  const isTokenAToken0 = parseInt(tokenA.address, 16) < parseInt(tokenB.address, 16)

  const tokenADecimals = await tokenA.decimals()
  const tokenBDecimals = await tokenB.decimals()
  
  let rawPrice = tokenBPriceInA

  if (tokenBDecimals > tokenADecimals) {
    const diff = tokenBDecimals - tokenADecimals
    rawPrice /= 10 ** diff
  } else {
    const diff = tokenADecimals - tokenBDecimals
    rawPrice *= 10 ** diff
  }

  const sqrtX96Price = isTokenAToken0 
    ? convertToken1PriceToSqrtX96Price(rawPrice.toString()).toFixed(0)
    : convertToken0PriceToSqrtX96Price(rawPrice.toString()).toFixed(0)

  const token0Addr = isTokenAToken0 ? tokenA.address : tokenB.address
  const token1Addr = isTokenAToken0 ? tokenB.address : tokenA.address
  
  const poolAddrFirstTry = await univ3Factory.getPool(token0Addr, token1Addr, feeTier)
  if (poolAddrFirstTry !== ethers.constants.AddressZero) {
    return ethers.getContractAt("IUniswapV3Pool", poolAddrFirstTry);
  }

  await positionManager.createAndInitializePoolIfNecessary(
    token0Addr,
    token1Addr,
    feeTier,
    sqrtX96Price
  )

  // avoid poolAddr being address(0) because requested too fast after last transaction. 
  let poolAddr: string 
  while(true) {
    await delay(5000)
    poolAddr = await univ3Factory.getPool(token0Addr, token1Addr, feeTier)
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
  univ3Factory: Contract,
  fee = 3000
) => {
  const isTokenAToken0 = parseInt(tokenA.address, 16) < parseInt(tokenB.address, 16)

  const token0Addr = isTokenAToken0 ? tokenA.address : tokenB.address
  const token1Addr = isTokenAToken0 ? tokenB.address : tokenA.address
  const poolAddr = await univ3Factory.getPool(token0Addr, token1Addr, fee)
  return poolAddr as string
} 

/**
 * Deploy controller, squeeth token and vaultNFT
 * @returns 
 */
 export const deploySqueethCoreContracts= async(weth: Contract, dai: Contract, positionManager: Contract, uniswapFactory: Contract, wsqueethEthPrice?: number, ethDaiPrice?: number ) => {
  // const { deployer } = await getNamedAccounts();

  const ABDK = await ethers.getContractFactory("ABDKMath64x64")
  const ABDKLibrary = (await ABDK.deploy()) as ABDKMath64x64;

  const TickMath = await ethers.getContractFactory("TickMathExternal")
  const TickMathLibrary = (await TickMath.deploy());

  const SqrtPriceExternal = await ethers.getContractFactory("SqrtPriceMathPartial")
  const SqrtPriceExternalLibrary = (await SqrtPriceExternal.deploy());

  const ControllerContract = await ethers.getContractFactory("Controller", {libraries: {ABDKMath64x64: ABDKLibrary.address, TickMathExternal: TickMathLibrary.address, SqrtPriceMathPartial: SqrtPriceExternalLibrary.address}});

  const OracleContract = await ethers.getContractFactory("Oracle");
  const oracle = (await OracleContract.deploy()) as Oracle;

  const NFTContract = await ethers.getContractFactory("ShortPowerPerp");
  const shortSqueeth = (await NFTContract.deploy('short Squeeth', 'sSQU')) as ShortPowerPerp;

  const WPowerPerpContract = await ethers.getContractFactory("WPowerPerp");
  const wsqueeth = (await WPowerPerpContract.deploy('Wrapped Squeeth', 'wSQU')) as WPowerPerp;

  // 1 squeeth is 3000 eth
  const squeethPriceInEth = wsqueethEthPrice || 0.3
  const wsqueethEthPool = await createUniPool(squeethPriceInEth, weth, wsqueeth, positionManager, uniswapFactory) as Contract
  // 1 weth is 3000 dai
  const ethPriceInDai = ethDaiPrice || 3000
  const ethDaiPool = await createUniPool(ethPriceInDai, dai, weth, positionManager, uniswapFactory) as Contract

  await wsqueethEthPool.increaseObservationCardinalityNext(500) 
  await ethDaiPool.increaseObservationCardinalityNext(500) 

  const controller = (await ControllerContract.deploy(oracle.address, 
    shortSqueeth.address, 
    wsqueeth.address,
    weth.address, 
    dai.address, 
    ethDaiPool.address, 
    wsqueethEthPool.address, 
    positionManager.address,
    3000,
  )) as Controller;
  
  await shortSqueeth.init(controller.address);
  await wsqueeth.init(controller.address);
  
  return { controller, wsqueeth, shortSqueeth, ethDaiPool, wsqueethEthPool, oracle }
}

export const addSqueethLiquidity = async(
  squeethPriceInETH: number, 
  initLiquiditySqueethAmount: string, 
  collateralAmount: string,
  deployer: string,
  squeeth: WPowerPerp, 
  weth: WETH9,
  positionManager: Contract,
  controller: Controller,
  feeTier = 3000
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
      fee: feeTier,
      tickLower: -887220,// int24 min tick used when selecting full range
      tickUpper: 887220,// int24 max tick used when selecting full range
      amount0Desired: isWethToken0 ? liquidityWethAmount : liquidityWSqueethAmount,
      amount1Desired: isWethToken0 ? liquidityWSqueethAmount : liquidityWethAmount,
      amount0Min: 1,
      amount1Min: 1,
      recipient: deployer,// address
      deadline: Math.floor(await getNow(ethers.provider) + 8640000),// uint256
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
  positionManager: Contract,
  feeTier = 3000
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
      fee: feeTier,
      tickLower: -887220,// int24 min tick used when selecting full range
      tickUpper: 887220,// int24 max tick used when selecting full range
      amount0Desired: isWethToken0 ? ethAmount.toString() : daiAmount.toString(),
      amount1Desired: isWethToken0 ? daiAmount.toString() : ethAmount.toString(),
      amount0Min: 1,
      amount1Min: 1,
      recipient: deployer,// address
      deadline: Math.floor(await getNow(ethers.provider) + 8640000),// uint256
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
    deadline: Math.floor(await getNow(ethers.provider) + 8640000)
  }
  await (positionManager as INonfungiblePositionManager).decreaseLiquidity(burnParam)
}

function delay(ms: number) {
  return new Promise( resolve => setTimeout(resolve, ms) );
}

export const buyWSqueeth = async(router: Contract, wsqueeth: Contract, weth: Contract, recipient: string, amountIn: BigNumber, deadline: number) => {
  const swapParam = {
    tokenIn: weth.address,
    tokenOut: wsqueeth.address,
    fee: 3000,
    recipient,
    deadline,
    amountIn,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0
  }
  
  await weth.deposit({value: amountIn});
  await weth.approve(router.address, amountIn);

  await router.exactInputSingle(swapParam);
}

export const buyWeth = async(router: Contract, wsqueeth: Contract, weth: Contract, recipient: string, amountIn: BigNumber, deadline: number) => {
  const swapParam = {
    tokenIn: wsqueeth.address,
    tokenOut: weth.address,
    fee: 3000,
    recipient,
    deadline,
    amountIn,
    amountOutMinimum: 0,
    sqrtPriceLimitX96: 0
  }
  
  await wsqueeth.approve(router.address, amountIn);

  await router.exactInputSingle(swapParam);
}
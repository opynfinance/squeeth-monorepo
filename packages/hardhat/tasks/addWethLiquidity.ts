import { task, types } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import { utils, BigNumber } from "ethers";
import { getWETH, getUniswapDeployments, getUSDC } from './utils'

const { formatEther, parseEther } = utils

// Example execution
/**
 npx hardhat addWethLiquidity --network ropsten --weth-amount 0.5 --base-price 3500
 */
task("addWethLiquidity", "Add liquidity to WETH/DAI pool")
  .addParam('wethAmount', 'amount weth', '0.5', types.string)
  .addParam('basePrice', 'estimated wsqueeth/weth price', 3000, types.int)
  .setAction(async ({
    wethAmount,
    basePrice
  }, hre) => {

  const { getNamedAccounts, ethers, network } = hre;

  if (network.name === 'mainnet') {
    throw Error('This script is not supposed to be used on mainnet')
  }
  
  const { deployer } = await getNamedAccounts();
  const { positionManager, uniswapFactory } = await getUniswapDeployments(ethers, deployer, network.name)

  const usdc = await getUSDC(ethers, deployer, network.name)
  const weth = await getWETH(ethers, deployer, network.name)

  const isWethToken0 = parseInt(weth.address, 16) < parseInt(usdc.address, 16)
  const token0 = isWethToken0 ? weth.address : usdc.address
  const token1 = isWethToken0 ? usdc.address : weth.address

  // get current spot price form the pool
  const poolAddr = await uniswapFactory.getPool(token0, token1, 3000)

  console.log(`Adding liquidity to WETH/DAI pool: ${poolAddr}`)
  console.log(`WETH Price in USDC: ${basePrice}`)
  
  const wethLiquidityAmount = parseEther(wethAmount)
  let usdcLiquidityAmount = wethLiquidityAmount.mul(basePrice)
  const usdcDecimals = 6
  const wethDecimals = 18
  
  usdcLiquidityAmount = usdcLiquidityAmount.div(BigNumber.from(10).pow(wethDecimals-usdcDecimals))
  

  
  const daiBalance = await usdc.balanceOf(deployer)
  let wethBalance = await weth.balanceOf(deployer)

  if (wethBalance.lt(wethLiquidityAmount)) {
    const tx = await weth.deposit({value: wethLiquidityAmount.toString(), from: deployer})
    await ethers.provider.waitForTransaction(tx.hash, 1)
    wethBalance = await weth.balanceOf(deployer)
  }

  if (daiBalance.lt(usdcLiquidityAmount)) {
    console.log(`Minting ${formatEther(usdcLiquidityAmount)} USDC`)
    const tx = await usdc.mint(deployer, usdcLiquidityAmount) 
    await ethers.provider.waitForTransaction(tx.hash, 1)
  }

  // approve weth and wsqueeth to be used by position manager
  const wethAllowance = await weth.allowance(deployer, positionManager.address)
  if (wethAllowance.lt(wethLiquidityAmount)) {
    console.log(`Approving weth...`)
    const tx = await weth.approve(positionManager.address, ethers.constants.MaxUint256)
    await ethers.provider.waitForTransaction(tx.hash, 1)
  }

  const usdcAllowance = await usdc.allowance(deployer, positionManager.address)
  if (usdcAllowance.lt(usdcLiquidityAmount)) {
    console.log(`Approving USDC...`)
    const tx = await usdc.approve(positionManager.address, ethers.constants.MaxUint256)
    await ethers.provider.waitForTransaction(tx.hash, 1)
  }
  
  const minWeth = 0
  const minSqueeth = 0

  const mintParam = {
    token0,
    token1,
    fee: 3000,
    tickLower: -887220,// int24 min tick used when selecting full range
    tickUpper: 887220,// int24 max tick used when selecting full range
    amount0Desired: isWethToken0 ? wethLiquidityAmount : usdcLiquidityAmount,
    amount1Desired: isWethToken0 ? usdcLiquidityAmount : wethLiquidityAmount,
    amount0Min: isWethToken0 ? minWeth : minSqueeth,
    amount1Min: isWethToken0 ? minSqueeth : minWeth,
    recipient: deployer,// address
    deadline: Math.floor(Date.now() / 1000 + 86400),// uint256
  }

  await positionManager.mint(mintParam)

});


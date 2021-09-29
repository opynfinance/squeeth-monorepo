import { task, types } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import { utils } from "ethers";
import { getWETH, getUniswapDeployments } from './utils'

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

  const dai = await ethers.getContract("MockErc20", deployer);
  const weth = await getWETH(ethers, deployer, network.name)

  const isWethToken0 = parseInt(weth.address, 16) < parseInt(dai.address, 16)
  const token0 = isWethToken0 ? weth.address : dai.address
  const token1 = isWethToken0 ? dai.address : weth.address

  // get current spot price form the pool
  const poolAddr = await uniswapFactory.getPool(token0, token1, 3000)

  console.log(`Adding liquidity to WETH/DAI pool: ${poolAddr}`)
  console.log(`WETH Price in DAI: ${basePrice}`)
  
  const wethLiquidityAmount = parseEther(wethAmount)
  const daiLiquidityAmount = wethLiquidityAmount.mul(basePrice)
  
  const daiBalance = await dai.balanceOf(deployer)
  let wethBalance = await weth.balanceOf(deployer)

  if (wethBalance.lt(wethLiquidityAmount)) {
    const tx = await weth.deposit({value: wethLiquidityAmount.toString(), from: deployer})
    await ethers.provider.waitForTransaction(tx.hash, 1)
    wethBalance = await weth.balanceOf(deployer)
  }

  if (daiBalance.lt(daiLiquidityAmount)) {
    console.log(`Minting ${formatEther(daiLiquidityAmount)} DAI`)
    const tx = await dai.mint(deployer, daiLiquidityAmount) 
    await ethers.provider.waitForTransaction(tx.hash, 1)
  }

  // approve weth and wsqueeth to be used by position manager
  const wethAllowance = await weth.allowance(deployer, positionManager.address)
  if (wethAllowance.lt(wethLiquidityAmount)) {
    console.log(`Approving weth...`)
    const tx = await weth.approve(positionManager.address, ethers.constants.MaxUint256)
    await ethers.provider.waitForTransaction(tx.hash, 1)
  }

  const daiAllowance = await dai.allowance(deployer, positionManager.address)
  if (daiAllowance.lt(daiLiquidityAmount)) {
    console.log(`Approving DAI...`)
    const tx = await dai.approve(positionManager.address, ethers.constants.MaxUint256)
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
    amount0Desired: isWethToken0 ? wethLiquidityAmount : daiLiquidityAmount,
    amount1Desired: isWethToken0 ? daiLiquidityAmount : wethLiquidityAmount,
    amount0Min: isWethToken0 ? minWeth : minSqueeth,
    amount1Min: isWethToken0 ? minSqueeth : minWeth,
    recipient: deployer,// address
    deadline: Math.floor(Date.now() / 1000 + 86400),// uint256
  }

  await positionManager.mint(mintParam)

});


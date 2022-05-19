import { task, types } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import { getWETH, getUniswapDeployments } from './utils'

const tickSpace = 60

const estimated2xTickDelta = 6960 // 1.0001 ^ 6960 ~= 2. this number need to be dividable by 60

// eslint-disable-next-line
const estimated1_5xTickDelta = 4020 // 1.0001 ^ 4020 ~= 1.5 this number need to be dividable by 60

// Example execution
/**
  npx hardhat addSqueethLiquidity --network ropsten --wsqueeth-amount 0.0004 --collateral-amount 2 --base-price 3300 --range 2x
 */
task("addSqueethLiquidity", "Add liquidity to wsqueeth pool")
  .addParam('wsqueethAmount', 'amount of wsqueeth minting to add liquidity', '10', types.string)
  .addParam('collateralAmount', 'amount used as collateral to mint squeeth', '6', types.string)
  .addParam('basePrice', 'estimated wsqueeth/weth price', '0.3', types.string)
  .addParam('range', 'either full, 1.5x or 2x', '1.5x', types.string)
  .setAction(async ({
    wsqueethAmount,
    collateralAmount,
    basePrice,
    range
  }, hre) => {

  const { getNamedAccounts, ethers, network } = hre;
  
  const { deployer } = await getNamedAccounts();
  const { positionManager, uniswapFactory } = await getUniswapDeployments(ethers, deployer, network.name)

  const controller = await ethers.getContract("Controller", deployer);
  const wsqueeth = await ethers.getContract("WPowerPerp", deployer);
  const weth = await getWETH(ethers, deployer, network.name)

  const isWethToken0 = parseInt(weth.address, 16) < parseInt(wsqueeth.address, 16)
  const token0 = isWethToken0 ? weth.address : wsqueeth.address
  const token1 = isWethToken0 ? wsqueeth.address : weth.address

  const poolAddr = await uniswapFactory.getPool(token0, token1, 3000)
  console.log(`Adding liquidity to squeeth pool: ${poolAddr}`)

  const poolContract = await ethers.getContractAt("IUniswapV3Pool", poolAddr)
  const {tick} = await poolContract.slot0()

  const squeethPriceInETH = parseFloat(basePrice)

  console.log(`estimated Squeeth Price in ETH: ${squeethPriceInETH}`)
  
  const liquidityWsqueethAmount = ethers.utils.parseEther(wsqueethAmount) 
  const wethAmount = parseFloat(wsqueethAmount) * squeethPriceInETH
  const liquidityWethAmount = ethers.utils.parseEther(wethAmount.toString()) 
  
  let wsqueethBalance = await wsqueeth.balanceOf(deployer)
  let wethBalance = await weth.balanceOf(deployer)

  if (wethBalance.lt(liquidityWethAmount)) {
    const tx = await weth.deposit({value: liquidityWethAmount, from: deployer})
    await ethers.provider.waitForTransaction(tx.hash, 1)
    wethBalance = await weth.balanceOf(deployer)
  }

  if (wsqueethBalance.lt(liquidityWsqueethAmount)) {
    console.log(`Minting ${wsqueethAmount} rSqueeth amount of wsqueeth with ${collateralAmount} ETH`)
    const tx = await controller.mintWPowerPerpAmount(0, liquidityWsqueethAmount, 0, {value: ethers.utils.parseEther(collateralAmount)}) 
    await ethers.provider.waitForTransaction(tx.hash, 1)
    wsqueethBalance = await wsqueeth.balanceOf(deployer)
  }

  // approve weth and wsqueeth to be used by position manager
  const wethAllowance = await weth.allowance(deployer, positionManager.address)
  if (wethAllowance.lt(liquidityWethAmount)) {
    console.log(`Approving weth...`)
    const tx = await weth.approve(positionManager.address, ethers.constants.MaxUint256)
    await ethers.provider.waitForTransaction(tx.hash, 1)
  }

  const wsqueethAllowance = await wsqueeth.allowance(deployer, positionManager.address)
  if (wsqueethAllowance.lt(liquidityWsqueethAmount)) {
    console.log(`Approving wsqueeth...`)
    const tx = await wsqueeth.approve(positionManager.address, ethers.constants.MaxUint256)
    await ethers.provider.waitForTransaction(tx.hash, 1)
  }

  let tickLower = 0
  let tickUpper = 0
  if (range === 'full') {
    tickLower = -887220
    tickUpper = 887220
  } else {
    let tickDelta = 0
    if (range === '2x') {
      tickDelta = estimated2xTickDelta
      console.log(`using tick delta for 2x: ${tickDelta}`)
    } else {
      // eslint-disable-next-line
      tickDelta = estimated1_5xTickDelta
      console.log(`using tick delta for 1.5x: ${tickDelta}`)
    }
    const midTick = Math.floor(tick / tickSpace) * tickSpace
    tickUpper = midTick + tickDelta
    tickLower = midTick - tickDelta
    console.log(`Using tick range: ${tickLower} - ${tickUpper}`)
  }

  const mintParam = {
    token0,
    token1,
    fee: 3000,
    tickLower,
    tickUpper,
    amount0Desired: isWethToken0 ? liquidityWethAmount : liquidityWsqueethAmount,
    amount1Desired: isWethToken0 ? liquidityWsqueethAmount : liquidityWethAmount,
    amount0Min: 0,
    amount1Min: 0,
    recipient: deployer,// address
    deadline: Math.floor(Date.now() / 1000 + 86400),// uint256
  }

  const tx = await positionManager.mint(mintParam)
  console.log(`mint tx ${tx.hash}`)

});


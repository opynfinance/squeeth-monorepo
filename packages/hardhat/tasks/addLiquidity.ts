import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import { getWETH } from './utils'

// Example execution
/**
 npx hardhat addLiquidity
 */
task("addLiquidity", "Add liquidity to pool")
  .setAction(async (_, hre) => {

  const { getNamedAccounts, ethers, network } = hre;
  
  const { deployer } = await getNamedAccounts();
  const positionManager = await ethers.getContract("NonfungibleTokenPositionManager", deployer);

  const controller = await ethers.getContract("Controller", deployer);
  const squeeth = await ethers.getContract("WSqueeth", deployer);
  const weth = await getWETH(ethers, deployer, network.name)

  const initLiquiditySqueethAmount = '0.0001'
  const collateralAmount = '1'
  const squeethPriceInETH = 3000

  // const initLiquiditySqueethAmount = '0.01'
  // const collateralAmount = '60'
  // const squeethPriceInETH = 3000

  const isWethToken0 = parseInt(weth.address, 16) < parseInt(squeeth.address, 16)
  const token0 = isWethToken0 ? weth.address : squeeth.address
  const token1 = isWethToken0 ? squeeth.address : weth.address
  
  const liquiditySqueethAmount = ethers.utils.parseEther(initLiquiditySqueethAmount) 
  const wethAmount = parseFloat(initLiquiditySqueethAmount) * squeethPriceInETH
  const liquidityWethAmount = ethers.utils.parseEther(wethAmount.toString()) 
  
  const minWeth = 0
  const minSqueeth = 0
  
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
    amount0Min: isWethToken0 ? minWeth : minSqueeth,
    amount1Min: isWethToken0 ? minSqueeth : minWeth,
    recipient: deployer,// address
    deadline: Math.floor(Date.now() / 1000 + 86400),// uint256
  }

  await positionManager.mint(mintParam)

});


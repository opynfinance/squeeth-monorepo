import { task } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";

// Example execution
/**
 npx hardhat addLiquidity
 */
task("addLiquidity", "Add liquidity to pool")
  // .addParam('token0', 'default: weth address', undefined, types.string)
  // .addParam('token1', 'default: squeeth address', undefined, types.string)
  // .addParam('fee', 'fee (uint24)', 3000, types.int)
  .setAction(async (_, hre) => {


  const { getNamedAccounts, ethers } = hre;
  const { deployer } = await getNamedAccounts();
  const uniV3PositionManager = await ethers.getContract("NonfungibleTokenPositionManager", deployer);

  const controller = await ethers.getContract("Controller", deployer);
  const squeeth = await ethers.getContract("WSqueeth", deployer);
  const weth = await ethers.getContract("WETH9", deployer);

  const liquiditySqueethAmount = ethers.utils.parseEther('10') // each squeeth worth 0.3 eth
  const liquidityWethAmount = ethers.utils.parseEther('3') 

  let squeethBalance = await squeeth.balanceOf(deployer)
  let wethBalance = await weth.balanceOf(deployer)
  console.log(`SQU Balance: ${ethers.utils.formatUnits(squeethBalance.toString())}`)  

  if (wethBalance.lt(liquidityWethAmount)) {
    console.log(`Minting new WETH`)
    await weth.deposit({value: liquidityWethAmount})
    wethBalance = await weth.balanceOf(deployer)
  }

  if (squeethBalance.lt(liquiditySqueethAmount)) {
    // use 10 eth to mint 10 squeeth
    await controller.mint(0, liquiditySqueethAmount, {value: ethers.utils.parseEther('10')}) 
    console.log(`Minted ${ethers.utils.formatUnits(liquiditySqueethAmount.toString())} new SQU`)  
    squeethBalance = await squeeth.balanceOf(deployer)
  }
  
  await weth.approve(uniV3PositionManager.address, ethers.constants.MaxUint256)
  await squeeth.approve(uniV3PositionManager.address, ethers.constants.MaxUint256)
  console.log(`Approve done`)
  
  const mintParam = {
    token0: weth.address,// address
    token1: squeeth.address,// address
    fee: 3000,// uint24
    tickLower: -887220,// int24 min tick used when selecting full range
    tickUpper: 887220,// int24 max tick used when selecting full range
    amount0Desired: liquidityWethAmount.toString(),// uint256 
    amount1Desired: liquiditySqueethAmount.toString(),// uint256
    amount0Min: liquidityWethAmount.mul(9).div(10).toString(),// uint256
    amount1Min: liquiditySqueethAmount.mul(9).div(10).toString(),// uint256
    recipient: deployer,// address
    deadline: Math.floor(Date.now() / 1000 + 86400),// uint256
  }

  await uniV3PositionManager.mint(mintParam)

  const squeethBalanceAfter = await squeeth.balanceOf(deployer)
  const wethBalanceAfter = await weth.balanceOf(deployer)

  console.log(`Added ${ethers.utils.formatUnits(squeethBalance.sub(squeethBalanceAfter))} SQU to Pool`)
  console.log(`Added ${ethers.utils.formatUnits(wethBalance.sub(wethBalanceAfter))} WETH to pool`)
  
});

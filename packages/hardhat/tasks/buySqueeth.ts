import { task, types } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";

// Example execution
/**
 npx hardhat buySqueeth --input '0.1'
 */
task("buySqueeth", "Buy Squeeth from the pool")
  .addParam('input', 'amount weth paying', '0.05', types.string)
  .setAction(async ({input: inputAmount}, hre) => {
  const { getNamedAccounts, ethers } = hre;
  const { deployer } = await getNamedAccounts();
  
  const swapRouter = await ethers.getContractAt("SwapRouter", deployer);

  const squeeth = await ethers.getContractAt("WPowerPerp", deployer);
  const weth = await ethers.getContractAt("WETH9", deployer);

  const inputWETHAmount = ethers.utils.parseEther(inputAmount) 

  let wethBalance = await weth.balanceOf(deployer)
  
  const squeethBalance = await squeeth.balanceOf(deployer)
  
  
  if (wethBalance.lt(inputWETHAmount)) {
    console.log(`Minting new WETH`)
    await weth.deposit({value: inputWETHAmount})
    wethBalance = await weth.balanceOf(deployer)
  }

  console.log(`SQU Balance before trade:\t${ethers.utils.formatUnits(squeethBalance.toString())}`)  
  console.log(`WETH Balance before trade:\t${ethers.utils.formatUnits(wethBalance.toString())}`)  

  
  await weth.approve(swapRouter.address, ethers.constants.MaxUint256)
  console.log(`Approve WETH `)
  
  const exactInputParam = {
    tokenIn: weth.address, // address
    tokenOut: squeeth.address, // address
    fee: 3000, // uint24
    recipient: deployer, // address
    deadline: Math.floor(Date.now() / 1000 + 86400), // uint256
    amountIn: inputWETHAmount, // uint256
    amountOutMinimum: 0, // uint256 // no slippage control now
    sqrtPriceLimitX96: 0, // uint160
  }

  await swapRouter.exactInputSingle(exactInputParam)

  const squeethBalanceAfter = await squeeth.balanceOf(deployer)
  const wethBalanceAfter = await weth.balanceOf(deployer)

  console.log(`Bought ${ethers.utils.formatUnits(squeethBalanceAfter.sub(squeethBalance))} SQU from Uni Pool`)
  console.log(`Paid ${ethers.utils.formatUnits(wethBalance.sub(wethBalanceAfter))} WETH to Uni Pool`)
  
});

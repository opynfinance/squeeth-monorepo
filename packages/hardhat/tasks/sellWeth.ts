import { task, types } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import { BigNumber } from "ethers";
import { getUniswapDeployments, getUSDC, getWETH } from "./utils";

// Example execution
/**
 npx hardhat sellWeth --input '1000' --network ropsten
 */
task("sellWeth", "Sell Weth from the pool")
  .addParam('input', 'amount weth sending', '1000', types.string)
  .setAction(async ({ input: inputAmount }, hre) => {
    const { getNamedAccounts, ethers, network } = hre;
    const { deployer } = await getNamedAccounts();

    const { swapRouter } = await getUniswapDeployments(ethers, deployer, network.name);

    const usdc = await getUSDC(ethers, deployer, network.name)
    const weth = await getWETH(ethers, deployer, network.name)

    const wethDecimals = 18
    const wethAmount = BigNumber.from(inputAmount).mul(BigNumber.from(10).pow(wethDecimals))

    const wethBalance = await weth.balanceOf(deployer)

    // if (wethBalance.lt(wethAmount)) {
    //   console.log(`Minting new USDC`)
    //   const tx = await usdc.mint(deployer, usdcAmount)
    //   await ethers.provider.waitForTransaction(tx.hash, 1)
    // }

    const wethAllowance = await weth.allowance(deployer, swapRouter.address)
    if (wethAllowance.lt(wethAmount)) {
      console.log('Approving WETH')
      await weth.approve(swapRouter.address, ethers.constants.MaxUint256)
    }

    const exactInputParam = {
      tokenIn: weth.address, // address
      tokenOut: usdc.address, // address
      fee: 3000, // uint24
      recipient: deployer, // address
      deadline: Math.floor(Date.now() / 1000 + 86400), // uint256
      amountIn: wethAmount, // uint256
      amountOutMinimum: 0, // uint256 // no slippage control now
      sqrtPriceLimitX96: 0, // uint160
    }

    await swapRouter.exactInputSingle(exactInputParam)
    console.log(`Sold WETH from Uni Pool successfully`)

  });

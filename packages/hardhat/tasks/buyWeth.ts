import { task, types } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import { BigNumber } from "ethers";
import { getUniswapDeployments, getUSDC, getWETH } from "./utils";

// Example execution
/**
 npx hardhat wethWhacker --input '1000' --network ropsten
 */
task("wethWhacker", "Buy Weth from the pool")
  .addParam('input', 'amount usdc sending', '1000', types.string)
  .setAction(async ({ input: inputAmount }, hre) => {
    const { getNamedAccounts, ethers, network } = hre;
    const { deployer } = await getNamedAccounts();

    const { swapRouter } = await getUniswapDeployments(ethers, deployer, network.name);

    const usdc = await getUSDC(ethers, deployer, network.name)
    const weth = await getWETH(ethers, deployer, network.name)

    const usdcDecimals = 6
    const usdcAmount = BigNumber.from(inputAmount).mul(BigNumber.from(10).pow(usdcDecimals))

    const usdcBalance = await usdc.balanceOf(deployer)

    if (usdcBalance.lt(usdcAmount)) {
      console.log(`Minting new USDC`)
      const tx = await usdc.mint(deployer, usdcAmount)
      await ethers.provider.waitForTransaction(tx.hash, 1)
    }

    const usdcAllowance = await usdc.allowance(deployer, swapRouter.address)
    if (usdcAllowance.lt(usdcAmount)) {
      console.log('Approving USDC')
      await usdc.approve(swapRouter.address, ethers.constants.MaxUint256)
    }

    const exactInputParam = {
      tokenIn: usdc.address, // address
      tokenOut: weth.address, // address
      fee: 3000, // uint24
      recipient: deployer, // address
      deadline: Math.floor(Date.now() / 1000 + 86400), // uint256
      amountIn: usdcAmount, // uint256
      amountOutMinimum: 0, // uint256 // no slippage control now
      sqrtPriceLimitX96: 0, // uint160
    }

    await swapRouter.exactInputSingle(exactInputParam)
    console.log(`Bought WETH from Uni Pool successfully`)

  });

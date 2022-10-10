import { task, types } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import { BigNumber } from "ethers";
import { getUniswapDeployments, getUSDC, getWETH } from "./utils";

// Example execution
/**
 npx hardhat sellSqueeth --input '1000' --network ropsten
 */
task("sellSqueeth", "Sell Weth from the pool")
  .addParam('input', 'amount squeeth sending', '1', types.string)
  .setAction(async ({ input: inputAmount }, hre) => {
    const { getNamedAccounts, ethers, network } = hre;
    const { deployer } = await getNamedAccounts();

    const { swapRouter } = await getUniswapDeployments(ethers, deployer, network.name);

    const weth = await getWETH(ethers, deployer, network.name)
    const squeeth = await ethers.getContract("WPowerPerp", deployer);

    const oSqthDecimal = 18
    const oSqthAmount = BigNumber.from(inputAmount).mul(BigNumber.from(10).pow(oSqthDecimal))

    const sqthBalance = await squeeth.balanceOf(deployer)

    // if (wethBalance.lt(wethAmount)) {
    //   console.log(`Minting new USDC`)
    //   const tx = await usdc.mint(deployer, usdcAmount)
    //   await ethers.provider.waitForTransaction(tx.hash, 1)
    // }

    const sqthAllowance = await squeeth.allowance(deployer, squeeth.address)
    if (sqthAllowance.lt(oSqthAmount)) {
      console.log('Approving sqth')
      const tx = await squeeth.approve(swapRouter.address, ethers.constants.MaxUint256)
      tx.wait()
    }

    const exactInputParam = {
      tokenIn: squeeth.address, // address
      tokenOut: weth.address, // address
      fee: 3000, // uint24
      recipient: deployer, // address
      deadline: Math.floor(Date.now() / 1000 + 86400), // uint256
      amountIn: oSqthAmount, // uint256
      amountOutMinimum: 0, // uint256 // no slippage control now
      sqrtPriceLimitX96: 0, // uint160
    }

    const tx = await swapRouter.exactInputSingle(exactInputParam)
    tx.wait()
    console.log(`Sold oSqth to Uni Pool successfully`)

  });

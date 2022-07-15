import { task, types } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import { getWETH, getUniswapDeployments, getControllerHelper } from './utils'

// const tickSpace = 60

// const estimated2xTickDelta = 6960 // 1.0001 ^ 6960 ~= 2. this number need to be dividable by 60

// // eslint-disable-next-line
// const estimated1_5xTickDelta = 4020 // 1.0001 ^ 4020 ~= 1.5 this number need to be dividable by 60

// Example execution
/**
  npx hardhat claimLpFeeData --token-id 3300 --amount0-max 2 --amount1-max 3
 */
task("claimLpFeeData", "Claim LP fee")
  .addParam('tokenId', 'token ID', '10', types.string)
  .addParam('amount0Max', 'amount0 max', '10', types.string)
  .addParam('amount1Max', 'amount1 max', '10', types.string)
  .setAction(async ({
    tokenId,
    amount0Max,
    amount1Max
  }, hre) => {

  // const rebalanceLpInVaultType = 6;

  const { ethers } = hre;
  

  const abiCoder = new ethers.utils.AbiCoder

  console.log("claim fee data:", abiCoder.encode(["uint256", "uint128", "uint128"], [tokenId, amount0Max, amount1Max]));
});


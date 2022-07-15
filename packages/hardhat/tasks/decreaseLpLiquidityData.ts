import { task, types } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";

// Example execution
/**
  npx hardhat decreaseLpLiquidityData --token-id 1 --liquidity 2 --liquidity-percentage 3300 --amount0-min 2 --amount1-min 3
 */
task("decreaseLpLiquidityData", "decrease")
  .addParam('tokenId', 'vault ID', '10', types.string)
  .addParam('liquidity', 'liquidity', '6', types.string)
  .addParam('liquidityPercentage', 'percentage should be in 18 decimals', '10', types.string)
  .addParam('amount0Min', 'amount0 min', '10', types.string)
  .addParam('amount1Min', 'amount1 min', '10', types.string)
  .setAction(async ({
    tokenId,
    liquidity,
    liquidityPercentage,
    amount0Min,
    amount1Min
  }, hre) => {

  const {ethers} = hre;
  
  const abiCoder = new ethers.utils.AbiCoder
  console.log("decrease LP data:", abiCoder.encode(["uint256", 'uint256', 'uint256', 'uint128', 'uint128'], [tokenId, liquidity, liquidityPercentage, amount0Min, amount1Min]));
});


/* eslint-disable prefer-const */
import { Pool } from "../../generated/schema";
import {
  Swap as USDCSwapEvent,
  Initialize,
} from "../../generated/USDCPool/Pool";
import { Swap as OSQTHSwapEvent } from "../../generated/OSQTHPool/Pool";
import { sqrtPriceX96ToTokenPrices } from "../utils/pricing";
import {
  BIGINT_ZERO,
  TOKEN_DECIMALS_18,
  TOKEN_DECIMALS_USDC,
  USDC_WETH_POOL,
} from "../constants";
import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { createTransactionHistory } from "../util";

export function handleInitialize(event: Initialize): void {
  // update pool sqrt price
  let pool = new Pool(event.address.toHexString());

  pool.sqrtPrice = event.params.sqrtPriceX96;
  pool.createdAtTimestamp = event.block.timestamp;
  let token0_decimals = TOKEN_DECIMALS_18;
  let token1_decimals = TOKEN_DECIMALS_18;
  if (event.address.toHexString().toLowerCase() == USDC_WETH_POOL) {
    token0_decimals = TOKEN_DECIMALS_USDC;
  }
  let prices = sqrtPriceX96ToTokenPrices(
    pool.sqrtPrice,
    token0_decimals,
    token1_decimals
  );

  pool.token0Price = prices[0];
  pool.token1Price = prices[1];
  pool.save();
}

export function handleOSQTHSwap(event: OSQTHSwapEvent): void {
  let osqthPool = Pool.load(event.address.toHexString());
  let usdcPool = Pool.load(USDC_WETH_POOL);
  if (osqthPool == null || usdcPool == null) {
    return;
  }

  // token0 osqth
  // token1 weth
  // token0 per token1
  osqthPool.sqrtPrice = event.params.sqrtPriceX96;
  let osqthPrices = sqrtPriceX96ToTokenPrices(
    osqthPool.sqrtPrice,
    TOKEN_DECIMALS_18,
    TOKEN_DECIMALS_18
  );

  osqthPool.token0Price = osqthPrices[0];
  osqthPool.token1Price = osqthPrices[1];
  osqthPool.save();

  let transactionType = "";
  // selling
  if (event.params.amount0.gt(BIGINT_ZERO)) {
    transactionType = "SELL_OSQTH";
  }

  if (event.params.amount0.lt(BIGINT_ZERO)) {
    transactionType = "BUY_OSQTH";
  }

  const transactionHistory = createTransactionHistory(transactionType, event);

  transactionHistory.timestamp = event.block.timestamp;
  transactionHistory.transactionType;
  transactionHistory.sender = event.transaction.from;
  transactionHistory.oSqthAmount = event.params.amount0;
  transactionHistory.ethAmount = event.params.amount1;
  transactionHistory.oSqthPriceInETH = osqthPrices[0];

  transactionHistory.save();
}

export function handleUSDCSwap(event: USDCSwapEvent): void {
  // token0 osqth
  // token1 weth
  // token0 per token1
  let pool = Pool.load(event.address.toHexString());
  if (pool == null) {
    return;
  }
  pool.sqrtPrice = event.params.sqrtPriceX96;

  let prices = sqrtPriceX96ToTokenPrices(
    pool.sqrtPrice,
    TOKEN_DECIMALS_USDC,
    TOKEN_DECIMALS_18
  );
  pool.token0Price = prices[0];
  pool.token1Price = prices[1];
  pool.save();
}

/* eslint-disable prefer-const */
import { TransactionHistory, Pool } from "../../generated/schema";
import { Swap as SwapEvent, Initialize } from "../../generated/OSQTHPool/Pool";
import { sqrtPriceX96ToTokenPrices } from "../utils/pricing";
import { BIGINT_ZERO, ZERO_BD } from "../constants";
import { BigInt } from "@graphprotocol/graph-ts";

export function handleInitialize(event: Initialize): void {
  // update pool sqrt price and tick
  let pool = new Pool(event.address.toHexString()) as Pool;
  pool.sqrtPrice = event.params.sqrtPriceX96;
  pool.createdAtTimestamp = event.block.timestamp;
  let prices = sqrtPriceX96ToTokenPrices(pool.sqrtPrice);

  // if (!prices && !prices[0] && !prices[1]) {
  pool.token0Price = prices[0];
  pool.token1Price = prices[1];
  // }

  pool.save();
}

export function handleOSQTHSwap(event: SwapEvent): void {
  let transactionHistory = new TransactionHistory(
    `${event.transaction.hash.toHex()}-${event.logIndex}`
  );

  let pool = Pool.load(event.address.toHexString());
  if (pool == null) {
    return;
  }

  // token0 osqth
  // token1 weth
  // token0 per token1
  let sqrtPriceX96 = event.params.sqrtPriceX96;
  let prices = sqrtPriceX96ToTokenPrices(sqrtPriceX96);
  pool.sqrtPrice = sqrtPriceX96;
  pool.token0Price = prices[0];
  pool.token1Price = prices[1];
  pool.save();

  transactionHistory.oSqthPrice = prices[0];
  // selling
  if (event.params.amount0.gt(BIGINT_ZERO)) {
    transactionHistory.transactionType = "SELL_OSQTH";
  }
  // buying
  if (event.params.amount0.lt(BIGINT_ZERO)) {
    transactionHistory.transactionType = "BUY_OSQTH";
  }

  transactionHistory.sender = event.transaction.from;
  transactionHistory.oSqthAmount = event.params.amount0;
  transactionHistory.ethAmount = event.params.amount1;
  transactionHistory.timestamp = event.block.timestamp;

  transactionHistory.save();
}

export function handleUSDCSwap(event: SwapEvent): void {
  // token0 osqth
  // token1 weth
  // token0 per token1
  let prices = sqrtPriceX96ToTokenPrices(event.params.sqrtPriceX96);

  let pool = Pool.load(event.address.toHexString());
  if (pool == null) {
    return;
  }
  pool.sqrtPrice = event.params.sqrtPriceX96;
  pool.token0Price = prices[0];
  pool.token1Price = prices[1];
  pool.save();
}

/* eslint-disable prefer-const */
import { Pool, Position } from "../../generated/schema";
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
import {
  createTransactionHistory,
  getETHUSDCPrice,
  loadOrCreatePosition,
} from "../util";

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
  const position = loadOrCreatePosition(event.transaction.from.toHex());
  let usdcPrices = getETHUSDCPrice();

  if (osqthPool == null) {
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
  let positionBalance = position.positionBalance;
  // selling
  if (event.params.amount0.gt(BIGINT_ZERO)) {
    transactionType = "SELL_OSQTH";
  }

  // buying
  if (event.params.amount0.lt(BIGINT_ZERO)) {
    transactionType = "BUY_OSQTH";
  }

  // amount0 > 0, so need to subtract it from position balance
  // amount0 < 0, so need to subtract it from position balance to add it as positive number
  positionBalance = positionBalance.minus(event.params.amount0);
  // event.params.amount0 > 0, current accumulated cost - this tx osqth amount * osqth price in eth * eth in usd
  // event.params.amount0 < 0, current accumulated cost + this tx osqth amount * osqth price in eth * eth in usd
  position.unrealizedCost = position.unrealizedCost.minus(
    event.params.amount0
      .times(BigInt.fromString(osqthPrices[0].toString()))
      .times(BigInt.fromString(usdcPrices[1].toString()))
  );

  // > 0, long; < 0 short; = 0 neutral
  if (positionBalance.gt(BIGINT_ZERO)) {
    position.positionType = "LONG";
  } else if (positionBalance.lt(BIGINT_ZERO)) {
    position.positionType = "SHORT";
  } else {
    position.positionType = "NEUTRAL";
  }

  position.positionBalance = positionBalance;

  const transactionHistory = createTransactionHistory(transactionType, event);
  transactionHistory.timestamp = event.block.timestamp;
  transactionHistory.transactionType;
  transactionHistory.sender = event.transaction.from;
  transactionHistory.oSqthAmount = event.params.amount0;
  transactionHistory.ethAmount = event.params.amount1;
  transactionHistory.oSqthPriceInETH = osqthPrices[0];

  position.save();
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

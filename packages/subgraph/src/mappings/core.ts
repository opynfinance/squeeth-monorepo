/* eslint-disable prefer-const */
import { Pool, Position } from "../../generated/schema";
import {
  Swap as USDCSwapEvent,
  Initialize,
} from "../../generated/USDCPool/Pool";
import { Swap as OSQTHSwapEvent } from "../../generated/OSQTHPool/Pool";
import { sqrtPriceX96ToTokenPrices } from "../utils/pricing";
import {
  TOKEN_DECIMALS_18,
  TOKEN_DECIMALS_USDC,
  USDC_WETH_POOL,
  ZERO_BD,
} from "../constants";
import {
  initPosition,
  createTransactionHistory,
  getETHUSDCPrice,
  loadOrCreateAccount,
  loadOrCreatePosition,
} from "../util";
import { convertTokenToDecimal } from "../utils";

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
  if (osqthPool == null) {
    return;
  }

  const account = loadOrCreateAccount(event.transaction.from.toHex());
  let position = loadOrCreatePosition(event.transaction.from.toHex());
  const usdcPrices = getETHUSDCPrice();

  // token0 osqth
  // token1 weth
  // token0 per token1
  osqthPool.sqrtPrice = event.params.sqrtPriceX96;
  const osqthPrices = sqrtPriceX96ToTokenPrices(
    osqthPool.sqrtPrice,
    TOKEN_DECIMALS_18,
    TOKEN_DECIMALS_18
  );

  osqthPool.token0Price = osqthPrices[0];
  osqthPool.token1Price = osqthPrices[1];
  osqthPool.save();

  let transactionType = "";
  // amount0 > 0, selling, so need to subtract it from position balance
  // amount0 < 0, buying, so need to subtract it from position balance to add it as positive number
  const amount0 = convertTokenToDecimal(
    event.params.amount0,
    TOKEN_DECIMALS_18
  );
  const oldosqthUnrealizedAmount = position.currentOSQTHAmount;
  position.currentOSQTHAmount = oldosqthUnrealizedAmount.minus(amount0);
  if (position.currentOSQTHAmount.equals(ZERO_BD)) {
    position = initPosition(event.transaction.from.toHex(), position);
  } else {
    // > 0, long; < 0 short; = 0 none
    if (position.currentOSQTHAmount.gt(ZERO_BD)) {
      position.positionType = "LONG";
    } else if (position.currentOSQTHAmount.lt(ZERO_BD)) {
      position.positionType = "SHORT";
    }

    const osqthPriceInUSD = osqthPrices[0].times(usdcPrices[1]);
    // event.params.amount0 > 0, selling, current accumulated cost - this tx osqth amount * osqth price in eth * eth in usd
    // event.params.amount0 < 0, buying, current accumulated cost + this tx osqth amount * osqth price in eth * eth in usd
    const unrealizedOSQTHCost = position.unrealizedOSQTHUnitCost
      .times(oldosqthUnrealizedAmount)
      .minus(amount0.times(osqthPriceInUSD));
    position.unrealizedOSQTHUnitCost = unrealizedOSQTHCost.div(
      position.currentOSQTHAmount
    );

    // selling, updating realizedOSQTHAmount & realizedOSQTHUnitGain & realizedOSQTHUnitCost
    if (amount0.gt(ZERO_BD)) {
      transactionType = "SELL_OSQTH";
      const oldosqthRealizedAmount = position.realizedOSQTHAmount;
      position.realizedOSQTHAmount = oldosqthRealizedAmount.plus(amount0);
      const newRealizedOSQTHGain = position.realizedOSQTHUnitGain
        .times(oldosqthRealizedAmount)
        .plus(amount0.times(osqthPriceInUSD));
      position.realizedOSQTHUnitGain = newRealizedOSQTHGain.div(
        position.realizedOSQTHAmount
      );

      const newRealizedOSQTHCost = position.realizedOSQTHUnitCost
        .times(oldosqthRealizedAmount)
        .plus(amount0.times(position.unrealizedOSQTHUnitCost));
      position.realizedOSQTHUnitCost = newRealizedOSQTHCost.div(
        position.realizedOSQTHAmount
      );
    }
  }

  // buying
  if (amount0.lt(ZERO_BD)) {
    transactionType = "BUY_OSQTH";
  } else if (amount0.gt(ZERO_BD)) {
    transactionType = "SELL_OSQTH";
  }

  let transactionHistory = createTransactionHistory(transactionType, event);
  transactionHistory.oSqthAmount = event.params.amount0;
  transactionHistory.ethAmount = event.params.amount1;

  account.save();
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

/* eslint-disable prefer-const */
import { TransactionHistory } from "../../generated/schema";
import { Swap as SwapEvent } from "../../generated/Pool/Pool";
import { sqrtPriceX96ToOSQTHTokenPrices } from "../utils/pricing";
import { BIGINT_ZERO } from "../constants";

export function handleSwap(event: SwapEvent): void {
  let transactionHistory = new TransactionHistory(
    `${event.transaction.hash.toHex()}-${event.logIndex}`
  );

  // token0 osqth
  // token1 weth
  // token0 per token1
  let prices = sqrtPriceX96ToOSQTHTokenPrices(event.params.sqrtPriceX96);
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

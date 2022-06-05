/* eslint-disable prefer-const */
import {
  Collect,
  DecreaseLiquidity,
  IncreaseLiquidity,
} from "../../generated/NonfungiblePositionManager/NonfungiblePositionManager";
import { TransactionHistory } from "../../generated/schema";

import { BigDecimal } from "@graphprotocol/graph-ts";

export function handleIncreaseLiquidity(event: IncreaseLiquidity): void {
  let transactionHistory = new TransactionHistory(
    `${event.transaction.hash.toHex()}-${event.logIndex}`
  );

  transactionHistory.transactionType = "ADD_LIQUIDITY";
  transactionHistory.owner = event.transaction.from.toString();
  transactionHistory.oSqthAmount = event.params.amount0;
  transactionHistory.ethAmount = event.params.amount1;
  transactionHistory.timestamp = event.block.timestamp;
  transactionHistory.oSqthPrice = BigDecimal.zero();

  transactionHistory.save();
}

export function handleDecreaseLiquidity(event: DecreaseLiquidity): void {
  let transactionHistory = new TransactionHistory(
    `${event.transaction.hash.toHex()}-${event.logIndex}`
  );

  transactionHistory.transactionType = "REMOVE_LIQUIDITY";
  transactionHistory.owner = event.transaction.from.toString();
  transactionHistory.oSqthAmount = event.params.amount0;
  transactionHistory.ethAmount = event.params.amount1;
  transactionHistory.timestamp = event.block.timestamp;
  transactionHistory.oSqthPrice = BigDecimal.zero();

  transactionHistory.save();
}

export function handleCollect(event: Collect): void {
  let transactionHistory = new TransactionHistory(
    `${event.transaction.hash.toHex()}-${event.logIndex}`
  );

  transactionHistory.transactionType = "COLLECT_FEE";
  transactionHistory.owner = event.transaction.from.toString();
  transactionHistory.oSqthAmount = event.params.amount0;
  transactionHistory.ethAmount = event.params.amount1;
  transactionHistory.timestamp = event.block.timestamp;
  transactionHistory.oSqthPrice = BigDecimal.zero();

  transactionHistory.save();
}

/* eslint-disable prefer-const */
import {
  Collect,
  DecreaseLiquidity,
  IncreaseLiquidity,
} from "../../generated/NonfungiblePositionManager/NonfungiblePositionManager";
import { TransactionHistory } from "../../generated/schema";
import { BigDecimal } from "@graphprotocol/graph-ts";
import { createTransactionHistory } from "../util";

export function handleIncreaseLiquidity(event: IncreaseLiquidity): void {
  const transactionHistory = createTransactionHistory("ADD_LIQUIDITY", event);
  transactionHistory.owner = event.transaction.from.toString();
  transactionHistory.oSqthAmount = event.params.amount0;
  transactionHistory.ethAmount = event.params.amount1;
  transactionHistory.oSqthPrice = BigDecimal.zero();

  transactionHistory.save();
}

export function handleDecreaseLiquidity(event: DecreaseLiquidity): void {
  const transactionHistory = createTransactionHistory(
    "REMOVE_LIQUIDITY",
    event
  );
  transactionHistory.owner = event.transaction.from.toString();
  transactionHistory.oSqthAmount = event.params.amount0;
  transactionHistory.ethAmount = event.params.amount1;
  transactionHistory.oSqthPrice = BigDecimal.zero();

  transactionHistory.save();
}

export function handleCollect(event: Collect): void {
  const transactionHistory = createTransactionHistory("COLLECT_FEE", event);
  transactionHistory.owner = event.transaction.from.toString();
  transactionHistory.oSqthAmount = event.params.amount0;
  transactionHistory.ethAmount = event.params.amount1;
  transactionHistory.oSqthPrice = BigDecimal.zero();

  transactionHistory.save();
}

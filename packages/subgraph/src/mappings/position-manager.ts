/* eslint-disable prefer-const */
import {
  Collect,
  DecreaseLiquidity,
  IncreaseLiquidity,
} from "../../generated/NonfungiblePositionManager/NonfungiblePositionManager";
import { Position } from "../../generated/schema";
import { ONE_BI, TOKEN_DECIMALS_18, ZERO_BD, ZERO_BI } from "../constants";
import {
  createTransactionHistory,
  getETHUSDCPrice,
  getoSQTHETHPrice,
  loadOrCreateAccount,
  loadOrCreatePosition,
} from "../util";
import { convertTokenToDecimal } from "../utils";
import { BigInt } from "@graphprotocol/graph-ts";

function updateLPposition(
  userAddr: string,
  eventAmount0: BigInt,
  eventAmount1: BigInt
) {
  let usdcPrices = getETHUSDCPrice();
  let osqthPrices = getoSQTHETHPrice();

  const lpPosition = loadOrCreatePosition("LP", userAddr);
  let amount0 = convertTokenToDecimal(eventAmount0, TOKEN_DECIMALS_18);
  let amount1 = convertTokenToDecimal(eventAmount1, TOKEN_DECIMALS_18);
  lpPosition.osqthBalance = lpPosition.osqthBalance.plus(amount0);
  lpPosition.ethBalance = lpPosition.ethBalance.plus(amount1);

  if (lpPosition.osqthBalance == ZERO_BD && lpPosition.ethBalance == ZERO_BD) {
    lpPosition.unrealizedOSQTHCost = ZERO_BD;
    lpPosition.unrealizedETHCost = ZERO_BD;
  } else {
    lpPosition.unrealizedOSQTHCost = lpPosition.unrealizedOSQTHCost.plus(
      lpPosition.osqthBalance.times(osqthPrices[3])
    );
    lpPosition.unrealizedETHCost = lpPosition.unrealizedETHCost.plus(
      lpPosition.ethBalance.times(usdcPrices[1])
    );
  }

  const longPosition = Position.load(`${userAddr}-${"LONG"}`);
  if (longPosition != null) {
    longPosition.osqthBalance = longPosition.osqthBalance.minus(amount0);
    longPosition.unrealizedOSQTHCost = longPosition.unrealizedOSQTHCost.minus(
      amount0.times(osqthPrices[3])
    );
    const newRealizedOSQTHGain = longPosition.realizedOSQTHAmount
      .times(longPosition.realizedOSQTHUnitGain)
      .plus(osqthPrices[3].times(amount0));
    longPosition.realizedOSQTHUnitGain = newRealizedOSQTHGain.div(
      longPosition.realizedOSQTHAmount.plus(amount0)
    );
    longPosition.realizedOSQTHAmount =
      longPosition.realizedOSQTHAmount.plus(amount0);
  }

  lpPosition.save();
  longPosition.save();
}

// selling to remove lp
export function handleIncreaseLiquidity(event: IncreaseLiquidity): void {
  const transactionHistory = createTransactionHistory("ADD_LIQUIDITY", event);
  transactionHistory.oSqthAmount = event.params.amount0;
  transactionHistory.ethAmount = event.params.amount1;
  transactionHistory.save();

  let userAddr = event.transaction.from.toHex();
  const account = loadOrCreateAccount(userAddr);
  updateLPposition(userAddr, event.params.amount0, event.params.amount1);
  account.save();
}

// buying to remove lp
export function handleDecreaseLiquidity(event: DecreaseLiquidity): void {
  const transactionHistory = createTransactionHistory(
    "REMOVE_LIQUIDITY",
    event
  );
  transactionHistory.oSqthAmount = event.params.amount0;
  transactionHistory.ethAmount = event.params.amount1;

  transactionHistory.save();

  let userAddr = event.transaction.from.toHex();
  const account = loadOrCreateAccount(userAddr);
  updateLPposition(
    userAddr,
    event.params.amount0.times(ZERO_BI.minus(ONE_BI)),
    event.params.amount1.times(ZERO_BI.minus(ONE_BI))
  );
  account.save();
}

export function handleCollect(event: Collect): void {
  const transactionHistory = createTransactionHistory("COLLECT_FEE", event);
  transactionHistory.oSqthAmount = event.params.amount0;
  transactionHistory.ethAmount = event.params.amount1;

  transactionHistory.save();

  let userAddr = event.transaction.from.toHex();
  const account = loadOrCreateAccount(userAddr);
  updateLPposition(userAddr, event.params.amount0, event.params.amount1);
  account.save();
}

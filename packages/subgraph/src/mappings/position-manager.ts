/* eslint-disable prefer-const */
import {
  Collect,
  DecreaseLiquidity,
  IncreaseLiquidity,
} from "../../generated/NonfungiblePositionManager/NonfungiblePositionManager";
import { LPPosition, Position } from "../../generated/schema";
import { ONE_BI, TOKEN_DECIMALS_18, ZERO_BD, ZERO_BI } from "../constants";
import {
  initLPPosition,
  createTransactionHistory,
  getETHUSDCPrice,
  getoSQTHETHPrice,
  loadOrCreateAccount,
  loadOrCreateLPPosition,
  loadOrCreatePosition,
} from "../util";
import { convertTokenToDecimal } from "../utils";
import { BigInt } from "@graphprotocol/graph-ts";

function updateLPposition(
  userAddr: string,
  eventAmount0: BigInt,
  eventAmount1: BigInt
): LPPosition {
  const usdcPrices = getETHUSDCPrice();
  const osqthPrices = getoSQTHETHPrice();

  let lpPosition = loadOrCreateLPPosition(userAddr);
  const amount0 = convertTokenToDecimal(eventAmount0, TOKEN_DECIMALS_18);
  const amount1 = convertTokenToDecimal(eventAmount1, TOKEN_DECIMALS_18);
  const oldUnrealizedOSQTHAmount = lpPosition.unrealizedOSQTHAmount;
  const oldUnrealizedETHAmount = lpPosition.unrealizedETHAmount;
  lpPosition.unrealizedOSQTHAmount =
    lpPosition.unrealizedOSQTHAmount.plus(amount0);
  lpPosition.unrealizedETHAmount = lpPosition.unrealizedETHAmount.plus(amount1);

  if (
    lpPosition.unrealizedOSQTHAmount == ZERO_BD &&
    lpPosition.unrealizedETHAmount == ZERO_BD
  ) {
    lpPosition = initLPPosition(userAddr, lpPosition);
  } else {
    const unrealizedOSQTHCost = lpPosition.unrealizedOSQTHUnitCost
      .times(oldUnrealizedOSQTHAmount)
      .plus(amount0.times(osqthPrices[3]));
    lpPosition.unrealizedOSQTHUnitCost = unrealizedOSQTHCost.div(
      lpPosition.unrealizedOSQTHAmount
    );

    const unrealizedETHCost = lpPosition.unrealizedETHUnitCost
      .times(oldUnrealizedETHAmount)
      .plus(amount1.times(usdcPrices[1]));
    lpPosition.unrealizedOSQTHUnitCost = unrealizedETHCost.div(
      lpPosition.unrealizedETHAmount
    );
  }

  return lpPosition as LPPosition;
}

// selling to remove lp
export function handleIncreaseLiquidity(event: IncreaseLiquidity): void {
  const transactionHistory = createTransactionHistory("ADD_LIQUIDITY", event);
  transactionHistory.oSqthAmount = event.params.amount0;
  transactionHistory.ethAmount = event.params.amount1;
  transactionHistory.save();

  const osqthPrices = getoSQTHETHPrice();
  const osqthPriceInUSD = osqthPrices[3];
  const userAddr = event.transaction.from.toHex();
  const account = loadOrCreateAccount(userAddr);

  const lpPosition = updateLPposition(
    userAddr,
    event.params.amount0,
    event.params.amount1
  );
  const amount0 = convertTokenToDecimal(
    event.params.amount0,
    TOKEN_DECIMALS_18
  );

  // if long & lp
  const longPosition = Position.load(userAddr);
  if (longPosition == null) {
    return;
  } else if (longPosition != null && longPosition.positionType === "LONG") {
    lpPosition.isLongAndLP = true;
    // updateing unrealized long positions
    const oldosqthUnrealizedAmount = longPosition.unrealizedOSQTHAmount;
    longPosition.unrealizedOSQTHAmount =
      oldosqthUnrealizedAmount.minus(amount0);
    if (longPosition.unrealizedOSQTHAmount.equals(ZERO_BD)) {
      longPosition.positionType = "NONE";
    }
    const unrealizedOSQTHCost = longPosition.unrealizedOSQTHUnitCost
      .times(oldosqthUnrealizedAmount)
      .minus(amount0.times(osqthPriceInUSD));
    longPosition.unrealizedOSQTHUnitCost = unrealizedOSQTHCost.div(
      longPosition.unrealizedOSQTHAmount
    );

    // updateing realized long positions
    const oldosqthRealizedAmount = longPosition.realizedOSQTHAmount;
    longPosition.realizedOSQTHAmount = oldosqthRealizedAmount.plus(amount0);
    const newRealizedOSQTHGain = longPosition.realizedOSQTHUnitGain
      .times(oldosqthRealizedAmount)
      .plus(amount0.times(osqthPriceInUSD));
    longPosition.realizedOSQTHUnitGain = newRealizedOSQTHGain.div(
      longPosition.realizedOSQTHAmount
    );

    const newRealizedOSQTHCost = longPosition.realizedOSQTHUnitCost
      .times(oldosqthRealizedAmount)
      .plus(amount0.times(longPosition.unrealizedOSQTHUnitCost));
    longPosition.realizedOSQTHUnitCost = newRealizedOSQTHCost.div(
      longPosition.realizedOSQTHAmount
    );
  }

  lpPosition.save();
  longPosition.save();
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

  const osqthPrices = getoSQTHETHPrice();
  const osqthPriceInUSD = osqthPrices[3];
  let userAddr = event.transaction.from.toHex();
  const lpPosition = updateLPposition(
    userAddr,
    event.params.amount0.times(ZERO_BI.minus(ONE_BI)),
    event.params.amount1.times(ZERO_BI.minus(ONE_BI))
  );
  const amount0 = convertTokenToDecimal(
    event.params.amount0.times(ZERO_BI.minus(ONE_BI)),
    TOKEN_DECIMALS_18
  );

  const longPosition = Position.load(userAddr);
  if (longPosition == null) {
    return;
  }
  if (lpPosition.isLongAndLP == true) {
    // updateing unrealized long positions
    const oldosqthUnrealizedAmount = longPosition.unrealizedOSQTHAmount;
    longPosition.unrealizedOSQTHAmount =
      oldosqthUnrealizedAmount.minus(amount0);
    if (longPosition.unrealizedOSQTHAmount.equals(ZERO_BD)) {
      longPosition.positionType = "NONE";
    }
    const unrealizedOSQTHCost = longPosition.unrealizedOSQTHUnitCost
      .times(oldosqthUnrealizedAmount)
      .minus(amount0.times(osqthPriceInUSD));
    longPosition.unrealizedOSQTHUnitCost = unrealizedOSQTHCost.div(
      longPosition.unrealizedOSQTHAmount
    );
  }

  lpPosition.save();
  longPosition.save();
}

export function handleCollect(event: Collect): void {
  const transactionHistory = createTransactionHistory("COLLECT_FEE", event);
  transactionHistory.oSqthAmount = event.params.amount0;
  transactionHistory.ethAmount = event.params.amount1;
  transactionHistory.save();

  let userAddr = event.transaction.from.toHex();
  const account = loadOrCreateAccount(userAddr);
  const lpPosition = updateLPposition(
    userAddr,
    event.params.amount0,
    event.params.amount1
  );

  lpPosition.save();
  account.save();
}

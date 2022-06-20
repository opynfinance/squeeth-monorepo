import { BigDecimal } from "@graphprotocol/graph-ts";
import { ZERO_BD } from "../constants";
import {
  initPosition,
  loadOrCreateAccount,
  loadOrCreatePosition,
} from "./loadInit";

// buy sqth: amount > 0
// sell sqth: amount < 0
export function handleOSQTHChange(
  userAddr: string,
  amount: BigDecimal,
  osqthPriceInUSD: BigDecimal
): void {
  if (amount.equals(ZERO_BD) || userAddr == null) return;

  let position = loadOrCreatePosition(userAddr);
  let account = loadOrCreateAccount(userAddr);

  // When position type chages, reset PnLs and calculate with remaining amount
  let newAmount = position.currentOSQTHAmount.plus(amount);
  let positionBalanceBeforeTrade = position.currentOSQTHAmount.minus(
    BigDecimal.fromString(account.accShortAmount.toString())
  );
  let positionBalanceAfterTrade = newAmount.minus(
    BigDecimal.fromString(account.accShortAmount.toString())
  );

  if (newAmount.times(positionBalanceAfterTrade).lt(ZERO_BD)) {
    position = initPosition(userAddr, position);
    amount = newAmount;
  }

  let absAmount = amount.lt(ZERO_BD) ? amount.neg() : amount;
  let isLongBeforeTrade =
    positionBalanceBeforeTrade.gt(ZERO_BD) ||
    (positionBalanceBeforeTrade.equals(ZERO_BD) && amount.gt(ZERO_BD));

  let absCurrentOSQTHAmountBeforeTrade = position.currentOSQTHAmount.gt(ZERO_BD)
    ? position.currentOSQTHAmount
    : position.currentOSQTHAmount.neg();

  let absCurrentOSQTHAmountAfterTrade = position.currentOSQTHAmount
    .plus(amount)
    .gt(ZERO_BD)
    ? position.currentOSQTHAmount.plus(amount)
    : position.currentOSQTHAmount.plus(amount).neg();

  let oldUnrealizedOSQTHCost = position.unrealizedOSQTHUnitCost.times(
    absCurrentOSQTHAmountBeforeTrade
  );

  if (isLongBeforeTrade) {
    // Buy long
    if (amount.gt(ZERO_BD)) {
      let totalAmount = position.currentOSQTHAmount.plus(
        position.realizedOSQTHAmount
      );
      let oldRealizedOSQTHCost =
        position.realizedOSQTHUnitCost.times(totalAmount);

      if (!totalAmount.plus(amount).equals(ZERO_BD)) {
        position.realizedOSQTHUnitCost = oldRealizedOSQTHCost
          .plus(amount.times(osqthPriceInUSD))
          .div(totalAmount.plus(amount));
      }

      // Unrealized PnL calculation
      if (!newAmount.equals(ZERO_BD)) {
        position.unrealizedOSQTHUnitCost = oldUnrealizedOSQTHCost
          .plus(absAmount.times(osqthPriceInUSD))
          .div(absCurrentOSQTHAmountAfterTrade);
      }
    }

    // Sell long
    if (amount.lt(ZERO_BD)) {
      let oldRealizedOSQTHGain = position.realizedOSQTHAmount.times(
        position.realizedOSQTHUnitGain
      );

      position.realizedOSQTHAmount =
        position.realizedOSQTHAmount.plus(absAmount);
      if (!position.realizedOSQTHAmount.equals(ZERO_BD)) {
        position.realizedOSQTHUnitGain = oldRealizedOSQTHGain
          .plus(absAmount.times(osqthPriceInUSD))
          .div(position.realizedOSQTHAmount);
      }

      // Unrealized PnL calculation
      if (!newAmount.equals(ZERO_BD)) {
        position.unrealizedOSQTHUnitCost = oldUnrealizedOSQTHCost
          .minus(absAmount.times(osqthPriceInUSD))
          .div(absCurrentOSQTHAmountAfterTrade);
      }
    }
  } else {
    // Buy short
    if (amount.gt(ZERO_BD)) {
      let oldRealizedOSQTHGain = position.realizedOSQTHAmount.times(
        position.realizedOSQTHUnitGain
      );

      position.realizedOSQTHAmount = position.realizedOSQTHAmount.plus(amount);
      if (!position.realizedOSQTHAmount.equals(ZERO_BD)) {
        position.realizedOSQTHUnitGain = oldRealizedOSQTHGain
          .plus(amount.times(osqthPriceInUSD))
          .div(position.realizedOSQTHAmount);
      }

      // Unrealized PnL calculation
      if (!newAmount.equals(ZERO_BD)) {
        position.unrealizedOSQTHUnitCost = oldUnrealizedOSQTHCost
          .plus(absAmount.times(osqthPriceInUSD))
          .div(absCurrentOSQTHAmountAfterTrade);
      }
    }

    // sell short
    if (amount.lt(ZERO_BD)) {
      let totalAmount = position.currentOSQTHAmount.minus(
        position.realizedOSQTHAmount
      );

      if (totalAmount.lt(ZERO_BD)) {
        totalAmount = totalAmount.neg();
      }

      let oldRealizedOSQTHCost =
        position.realizedOSQTHUnitCost.times(totalAmount);

      if (!totalAmount.plus(amount).equals(ZERO_BD)) {
        position.realizedOSQTHUnitCost = oldRealizedOSQTHCost
          .plus(absAmount.times(osqthPriceInUSD))
          .div(totalAmount.plus(amount));
      }

      // Unrealized PnL calculation
      if (!newAmount.equals(ZERO_BD)) {
        position.unrealizedOSQTHUnitCost = oldUnrealizedOSQTHCost
          .minus(absAmount.times(osqthPriceInUSD))
          .div(absCurrentOSQTHAmountAfterTrade);
      }
    }
  }

  position.currentOSQTHAmount = position.currentOSQTHAmount.plus(amount);
  // = 0 none
  if (
    position.currentOSQTHAmount.equals(ZERO_BD) &&
    position.currentETHAmount.equals(ZERO_BD)
  ) {
    position = initPosition(userAddr, position);
  }

  position.save();
}

import { BigDecimal } from "@graphprotocol/graph-ts";
import { ZERO_BD } from "../constants";
import {
  initPosition,
  loadOrCreateAccount,
  loadOrCreatePosition,
} from "./loadInit";

// buy sqth: amount > 0
// sell sqth: amount < 0
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

  // When position side chages, reset PnLs and calculate with remaining amount
  let newAmount = position.currentOSQTHAmount.plus(amount);
  if (position.currentOSQTHAmount.times(newAmount).lt(ZERO_BD)) {
    position = initPosition(userAddr, position);
    amount = newAmount;
  }

  let absAmount = amount.lt(ZERO_BD) ? amount.neg() : amount;

  let balance = position.currentOSQTHAmount.minus(
    BigDecimal.fromString(account.accShortAmount.toString())
  );

  let isLong =
    balance.gt(ZERO_BD) || (balance.equals(ZERO_BD) && amount.gt(ZERO_BD));

  if (isLong) {
    // Buy long
    if (amount.gt(ZERO_BD)) {
      let totalAmount = position.currentOSQTHAmount.plus(
        position.realizedOSQTHAmount
      );
      let oldRealizedOSQTHCost =
        position.realizedOSQTHUnitCost.times(totalAmount);

      position.realizedOSQTHUnitCost = oldRealizedOSQTHCost
        .plus(amount.times(osqthPriceInUSD))
        .div(totalAmount.plus(amount));
    }

    // Sell long
    if (amount.lt(ZERO_BD)) {
      let oldRealizedOSQTHGain = position.realizedOSQTHAmount.times(
        position.realizedOSQTHUnitGain
      );

      position.realizedOSQTHAmount =
        position.realizedOSQTHAmount.plus(absAmount);
      position.realizedOSQTHUnitGain = oldRealizedOSQTHGain
        .plus(absAmount.times(osqthPriceInUSD))
        .div(position.realizedOSQTHAmount);
    }
  } else {
    if (amount.gt(ZERO_BD)) {
      let oldRealizedOSQTHGain = position.realizedOSQTHAmount.times(
        position.realizedOSQTHUnitGain
      );

      position.realizedOSQTHAmount =
        position.realizedOSQTHAmount.plus(absAmount);
      position.realizedOSQTHUnitGain = oldRealizedOSQTHGain
        .minus(amount.times(osqthPriceInUSD))
        .div(position.realizedOSQTHAmount);
    }

    if (amount.lt(ZERO_BD)) {
      let totalAmount = position.currentOSQTHAmount.minus(
        position.realizedOSQTHAmount
      );
      let oldRealizedOSQTHCost =
        position.realizedOSQTHUnitCost.times(totalAmount);

      position.realizedOSQTHUnitCost = oldRealizedOSQTHCost
        .plus(amount.times(osqthPriceInUSD))
        .div(totalAmount.plus(amount).neg());
    }
  }

  // Unrealized PnL calculation
  let oldUnrealizedOSQTHCost = position.unrealizedOSQTHUnitCost.times(
    position.currentOSQTHAmount
  );

  position.currentOSQTHAmount = position.currentOSQTHAmount.plus(amount);
  // = 0 none
  if (
    position.currentOSQTHAmount.equals(ZERO_BD) &&
    position.currentETHAmount.equals(ZERO_BD)
  ) {
    position = initPosition(userAddr, position);
  } else if (!position.currentOSQTHAmount.equals(ZERO_BD)) {
    position.unrealizedOSQTHUnitCost = oldUnrealizedOSQTHCost
      .plus(amount.times(osqthPriceInUSD))
      .div(position.currentOSQTHAmount);
  }

  position.save();
}

export function handleETHChange(
  userAddr: string,
  amount: BigDecimal,
  ethPriceInUSD: BigDecimal
): void {
  if (amount.equals(ZERO_BD) || userAddr == null) return;

  let position = loadOrCreatePosition(userAddr);

  // Buy
  if (amount.gt(ZERO_BD)) {
    let oldBoughtAmount = position.currentETHAmount.plus(
      position.realizedETHAmount
    );
    let oldRealizedETHCost =
      position.realizedETHUnitCost.times(oldBoughtAmount);

    position.realizedETHUnitCost = oldRealizedETHCost
      .plus(amount.times(ethPriceInUSD))
      .div(oldBoughtAmount.plus(amount));
  }

  // Sell
  if (amount.lt(ZERO_BD)) {
    let absAmount = amount.neg();
    let oldRealizedETHGain = position.realizedETHUnitGain.times(
      position.realizedETHAmount
    );

    position.realizedETHAmount = position.realizedETHAmount.plus(absAmount);
    position.realizedETHUnitGain = oldRealizedETHGain
      .plus(absAmount.times(ethPriceInUSD))
      .div(position.realizedETHAmount);
  }

  // Unrealized PnL calculation
  let oldUnrealizedETHCost = position.unrealizedETHUnitCost.times(
    position.currentETHAmount
  );
  position.currentETHAmount = position.currentETHAmount.plus(amount);
  // = 0 none
  if (
    position.currentOSQTHAmount.equals(ZERO_BD) &&
    position.currentETHAmount.equals(ZERO_BD)
  ) {
    position = initPosition(userAddr, position);
  } else if (!position.currentETHAmount.equals(ZERO_BD)) {
    position.unrealizedETHUnitCost = oldUnrealizedETHCost
      .plus(amount.times(ethPriceInUSD))
      .div(position.currentETHAmount);
  }

  position.save();
}

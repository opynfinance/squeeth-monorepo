import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { ethereum } from "@graphprotocol/graph-ts";
import { Pool, TransactionHistory } from "../generated/schema";
import { ZERO_BD, TOKEN_DECIMALS_USDC, TOKEN_DECIMALS_18 } from "./constants";
import { USDC_WETH_POOL, OSQTH_WETH_POOL } from "./addresses";
import { handleOSQTHChange } from "./utils/handler";
import {
  initLPPosition,
  initPosition,
  loadOrCreateLPPosition,
  loadOrCreatePosition,
} from "./utils/loadInit";
import { sqrtPriceX96ToTokenPrices } from "./utils/pricing";

export function bigExponent(base: i32, exp: i32): BigInt {
  let base_BI = BigInt.fromI32(base);
  let bd = base_BI;
  for (let i = 1; i < exp; i++) {
    bd = bd.times(base_BI);
  }
  return bd;
}

export function getETHUSDCPrice(): BigDecimal[] {
  let usdcPool = Pool.load(USDC_WETH_POOL);
  if (usdcPool == null) {
    return [ZERO_BD, ZERO_BD, ZERO_BD];
  }
  let usdcPrices = sqrtPriceX96ToTokenPrices(
    usdcPool.sqrtPrice,
    TOKEN_DECIMALS_USDC,
    TOKEN_DECIMALS_18
  );

  return [usdcPool.sqrtPrice.toBigDecimal(), usdcPrices[0], usdcPrices[1]];
}

export function getoSQTHETHPrice(): BigDecimal[] {
  let osqthPool = Pool.load(OSQTH_WETH_POOL);
  let usdcPrices = getETHUSDCPrice();

  if (osqthPool == null) {
    return [ZERO_BD, ZERO_BD, ZERO_BD, ZERO_BD];
  }

  let osqthPrices = sqrtPriceX96ToTokenPrices(
    osqthPool.sqrtPrice,
    TOKEN_DECIMALS_18,
    TOKEN_DECIMALS_18
  );

  return [
    osqthPool.sqrtPrice.toBigDecimal(),
    osqthPrices[0],
    osqthPrices[1],
    osqthPrices[1].times(usdcPrices[1]),
  ];
}

export function createTransactionHistory(
  transactionType: string,
  event: ethereum.Event
): TransactionHistory {
  let transactionHistory = new TransactionHistory(
    `${event.transaction.hash.toHex()}-${transactionType}`
  );

  let osqthPrices = getoSQTHETHPrice();
  let usdcPrices = getETHUSDCPrice();
  transactionHistory.owner = event.transaction.from;
  transactionHistory.timestamp = event.block.timestamp;
  transactionHistory.transactionType = transactionType;
  transactionHistory.oSqthAmount = BigInt.zero();
  transactionHistory.ethAmount = BigInt.zero();
  transactionHistory.ethUSDCSqrtPrice = BigInt.fromString(
    usdcPrices[0].toString()
  );
  transactionHistory.ethPriceInUSD = usdcPrices[1];
  transactionHistory.ethOSQTHSqrtPrice = BigInt.fromString(
    osqthPrices[0].toString()
  );
  transactionHistory.oSqthPriceInETH = osqthPrices[2];

  return transactionHistory;
}

// buy: amount > 0
// sell amount < 0
export function buyOrSellETH(userAddr: string, amount: BigDecimal): void {
  if (amount.equals(ZERO_BD) || userAddr == null) return;

  let usdcPrices = getETHUSDCPrice();
  let position = loadOrCreatePosition(userAddr);

  // Buy
  if (amount.gt(ZERO_BD)) {
    let oldBoughtAmount = position.currentETHAmount.plus(
      position.realizedETHAmount
    );
    let oldRealizedETHCost =
      position.realizedETHUnitCost.times(oldBoughtAmount);

    position.realizedETHUnitCost = oldRealizedETHCost
      .plus(amount.times(usdcPrices[1]))
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
      .plus(absAmount.times(usdcPrices[1]))
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
      .plus(amount.times(usdcPrices[1]))
      .div(position.currentETHAmount);
  }

  position.save();
}

export function buyOrSellSQTH(userAddr: string, amount: BigDecimal): void {
  let osqthPrices = getoSQTHETHPrice();

  handleOSQTHChange(userAddr, amount, osqthPrices[3]);
}

// buy: amount > 0
// sell amount < 0
export function buyOrSellLPETH(userAddr: string, amount: BigDecimal): void {
  if (amount.equals(ZERO_BD) || userAddr == null) return;
  let usdcPrices = getETHUSDCPrice();
  let position = loadOrCreateLPPosition(userAddr);

  // Buy
  if (amount.gt(ZERO_BD)) {
    let oldBoughtAmount = position.currentETHAmount.plus(
      position.realizedETHAmount
    );
    let oldRealizedETHCost =
      position.realizedETHUnitCost.times(oldBoughtAmount);

    position.realizedETHUnitCost = oldRealizedETHCost
      .plus(amount.times(usdcPrices[1]))
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
      .plus(absAmount.times(usdcPrices[1]))
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
    position = initLPPosition(userAddr, position);
  } else if (!position.currentETHAmount.equals(ZERO_BD)) {
    position.unrealizedETHUnitCost = oldUnrealizedETHCost
      .plus(amount.times(usdcPrices[1]))
      .div(position.currentETHAmount);
  }

  position.save();
}

// buy: amount > 0
// sell amount < 0
export function buyOrSellLPSQTH(userAddr: string, amount: BigDecimal): void {
  if (amount.equals(ZERO_BD) || userAddr == null) return;
  let osqthPrices = getoSQTHETHPrice();

  let position = loadOrCreateLPPosition(userAddr);

  // Buy
  if (amount.gt(ZERO_BD)) {
    let oldBoughtAmount = position.currentOSQTHAmount.plus(
      position.realizedOSQTHAmount
    );
    let oldRealizedOSQTHCost =
      position.realizedOSQTHUnitCost.times(oldBoughtAmount);

    position.realizedOSQTHUnitCost = oldRealizedOSQTHCost
      .plus(amount.times(osqthPrices[3]))
      .div(oldBoughtAmount.plus(amount));
  }

  // Sell
  if (amount.lt(ZERO_BD)) {
    let absAmount = amount.neg();
    let oldRealizedOSQTHGain = position.realizedOSQTHUnitCost.times(
      position.realizedOSQTHUnitGain
    );

    position.realizedOSQTHAmount = position.realizedOSQTHAmount.plus(absAmount);
    position.realizedOSQTHUnitGain = oldRealizedOSQTHGain
      .plus(absAmount.times(osqthPrices[3]))
      .div(position.realizedOSQTHAmount);
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
    position = initLPPosition(userAddr, position);
  } else if (!position.currentOSQTHAmount.equals(ZERO_BD)) {
    position.unrealizedOSQTHUnitCost = oldUnrealizedOSQTHCost
      .plus(amount.times(osqthPrices[3]))
      .div(position.currentOSQTHAmount);
  }

  position.save();
}

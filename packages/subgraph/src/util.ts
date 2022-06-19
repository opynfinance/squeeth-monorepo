import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { ethereum } from "@graphprotocol/graph-ts";
import {
  Account,
  LPPosition,
  Pool,
  Position,
  TransactionHistory,
} from "../generated/schema";
import {
  BIGINT_ZERO,
  USDC_WETH_POOL,
  ZERO_BD,
  OSQTH_WETH_POOL,
  TOKEN_DECIMALS_USDC,
  TOKEN_DECIMALS_18,
} from "./constants";
import { sqrtPriceX96ToTokenPrices } from "./utils/pricing";

export function bigExponent(base: i32, exp: i32): BigInt {
  let base_BI = BigInt.fromI32(base);
  let bd = base_BI;
  for (let i = 1; i < exp; i++) {
    bd = bd.times(base_BI);
  }
  return bd;
}

export function loadOrCreateAccount(accountId: string): Account {
  let account = Account.load(accountId);
  // if no account, create new entity
  if (account == null) {
    account = new Account(accountId);
    account.vaultCount = BIGINT_ZERO;
    account.accShortAmount = BIGINT_ZERO;
  }
  return account as Account;
}

export function initPosition(userAddr: string, position: Position): Position {
  position.owner = userAddr;

  position.currentOSQTHAmount = ZERO_BD;
  position.currentETHAmount = ZERO_BD;
  position.unrealizedOSQTHUnitCost = ZERO_BD;
  position.unrealizedETHUnitCost = ZERO_BD;

  position.realizedOSQTHUnitCost = ZERO_BD;
  position.realizedETHUnitCost = ZERO_BD;
  position.realizedOSQTHUnitGain = ZERO_BD;
  position.realizedETHUnitGain = ZERO_BD;
  position.realizedOSQTHAmount = ZERO_BD;
  position.realizedETHAmount = ZERO_BD;
  return position as Position;
}

export function initLPPosition(
  userAddr: string,
  lpPosition: LPPosition
): LPPosition {
  lpPosition.owner = userAddr;

  lpPosition.currentOSQTHAmount = ZERO_BD;
  lpPosition.currentETHAmount = ZERO_BD;
  lpPosition.unrealizedOSQTHUnitCost = ZERO_BD;
  lpPosition.unrealizedETHUnitCost = ZERO_BD;

  lpPosition.realizedOSQTHUnitCost = ZERO_BD;
  lpPosition.realizedETHUnitCost = ZERO_BD;
  lpPosition.realizedOSQTHUnitGain = ZERO_BD;
  lpPosition.realizedETHUnitGain = ZERO_BD;
  lpPosition.realizedOSQTHAmount = ZERO_BD;
  lpPosition.realizedETHAmount = ZERO_BD;
  lpPosition.collectedFeesETHAmount = ZERO_BD;
  lpPosition.collectedFeesOSQTHAmount = ZERO_BD;

  return lpPosition as LPPosition;
}

export function loadOrCreateLPPosition(userAddr: string): LPPosition {
  let lpPosition = LPPosition.load(userAddr);
  // if no position, create new entity
  if (lpPosition == null) {
    lpPosition = new LPPosition(userAddr);
    lpPosition = initLPPosition(userAddr, lpPosition);
  }
  return lpPosition as LPPosition;
}

export function loadOrCreatePosition(userAddr: string): Position {
  let position = Position.load(userAddr);
  // if no position, create new entity
  if (position == null) {
    position = new Position(userAddr);
    position = initPosition(userAddr, position);
  }
  return position as Position;
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
    }
  }

  // Unrealized PnL calculation
  let absCurrentOSQTHAmountBeforeTrade = position.currentOSQTHAmount.gt(ZERO_BD)
    ? position.currentOSQTHAmount
    : position.currentOSQTHAmount.neg();
  let oldUnrealizedOSQTHCost = position.unrealizedOSQTHUnitCost.times(
    absCurrentOSQTHAmountBeforeTrade
  );

  let absCurrentOSQTHAmountAfterTrade = position.currentOSQTHAmount
    .plus(amount)
    .gt(ZERO_BD)
    ? position.currentOSQTHAmount.plus(amount)
    : position.currentOSQTHAmount.plus(amount).neg();

  position.currentOSQTHAmount = position.currentOSQTHAmount.plus(amount);
  // = 0 none
  if (
    position.currentOSQTHAmount.equals(ZERO_BD) &&
    position.currentETHAmount.equals(ZERO_BD)
  ) {
    position = initPosition(userAddr, position);
  } else if (!position.currentOSQTHAmount.equals(ZERO_BD)) {
    position.unrealizedOSQTHUnitCost = oldUnrealizedOSQTHCost
      .plus(absAmount.times(osqthPriceInUSD))
      .div(absCurrentOSQTHAmountAfterTrade);
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

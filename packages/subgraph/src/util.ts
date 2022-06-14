import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Address, ethereum } from "@graphprotocol/graph-ts";
import {
  Account,
  LPPosition,
  Pool,
  Position,
  TransactionHistory,
} from "../generated/schema";
import {
  MAINNET_SHORT_HELPER_ADDR,
  ROPSTEN_SHORT_HELPER_ADDR,
  LOCALHOST_SHORT_HELPER_ADDR,
  RA_SHORT_HELPER_ADDR,
  BIGINT_ZERO,
  USDC_WETH_POOL,
  ZERO_BD,
  OSQTH_WETH_POOL,
  TOKEN_DECIMALS_USDC,
  TOKEN_DECIMALS_18,
  MAINNET_USDC_WETH_POOL,
  LOCALHOST_USDC_WETH_POOL,
  ROPSTEN_USDC_WETH_POOL,
  RA_USDC_WETH_POOL,
  MAINNET_OSQTH_WETH_POOL,
  ROPSTEN_OSQTH_WETH_POOL,
  LOCALHOST_OSQTH_WETH_POOL,
  RA_OSQTH_WETH_POOL,
  MAINNET_OSQTH,
  ROPSTEN_OSQTH,
  LOCALHOST_OSQTH,
  RA_OSQTH,
  MAINNET_WETH,
  ROPSTEN_WETH,
  LOCALHOST_WETH,
  RA_WETH,
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

export function getShortHelperAddr(networkName: string): Address {
  let addr = MAINNET_SHORT_HELPER_ADDR;
  if (networkName == "ropsten") {
    addr = ROPSTEN_SHORT_HELPER_ADDR;
  } else if (networkName == "localhost") {
    addr = LOCALHOST_SHORT_HELPER_ADDR;
  } else if (networkName == "rinkebyArbitrum") {
    addr = RA_SHORT_HELPER_ADDR;
  }
  return addr;
}

export function getUSDCPoolAddr(networkName: string): string {
  let addr = MAINNET_USDC_WETH_POOL;
  if (networkName == "ropsten") {
    addr = ROPSTEN_USDC_WETH_POOL;
  } else if (networkName == "localhost") {
    addr = LOCALHOST_USDC_WETH_POOL;
  } else if (networkName == "rinkebyArbitrum") {
    addr = RA_USDC_WETH_POOL;
  }
  return addr;
}

export function getoSQTHPoolAddr(networkName: string): string {
  let addr = MAINNET_OSQTH_WETH_POOL;
  if (networkName == "ropsten") {
    addr = ROPSTEN_OSQTH_WETH_POOL;
  } else if (networkName == "localhost") {
    addr = LOCALHOST_OSQTH_WETH_POOL;
  } else if (networkName == "rinkebyArbitrum") {
    addr = RA_OSQTH_WETH_POOL;
  }
  return addr;
}

export function getoSQTHTokenAddr(networkName: string): string {
  let addr = MAINNET_OSQTH;
  if (networkName == "ropsten") {
    addr = ROPSTEN_OSQTH;
  } else if (networkName == "localhost") {
    addr = LOCALHOST_OSQTH;
  } else if (networkName == "rinkebyArbitrum") {
    addr = RA_OSQTH;
  }
  return addr;
}

export function getWETHTokenAddr(networkName: string): string {
  let addr = MAINNET_WETH;
  if (networkName == "ropsten") {
    addr = ROPSTEN_WETH;
  } else if (networkName == "localhost") {
    addr = LOCALHOST_WETH;
  } else if (networkName == "rinkebyArbitrum") {
    addr = RA_WETH;
  }
  return addr;
}

export function loadOrCreateAccount(accountId: string): Account {
  let account = Account.load(accountId);
  // if no account, create new entity
  if (account == null) {
    account = new Account(accountId);
    account.vaultCount = BIGINT_ZERO;
  }
  return account as Account;
}

export function initPosition(userAddr: string, position: Position): Position {
  position.owner = userAddr;
  position.positionType = "NONE";

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
  lpPosition.isLongAndLP = false;

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
  transactionHistory.sender = event.transaction.from;
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
  let usdcPrices = getETHUSDCPrice();

  let position = loadOrCreatePosition(userAddr);

  // Sell
  if (amount.lt(ZERO_BD)) {
    let absAmount = amount.neg();

    let oldRealizedETHAmount = position.realizedETHAmount;
    position.realizedETHAmount = position.realizedETHAmount.plus(absAmount);

    let oldRealizedETHGain =
      position.realizedETHUnitGain.times(oldRealizedETHAmount);
    position.realizedETHUnitGain = oldRealizedETHGain
      .plus(absAmount.times(usdcPrices[1]))
      .div(position.realizedETHAmount);

    let oldRealizedETHCost =
      position.realizedETHUnitCost.times(oldRealizedETHAmount);
    position.realizedETHUnitCost = oldRealizedETHCost
      .plus(amount.times(usdcPrices[1]))
      .div(position.realizedETHAmount);
  }

  // Unrealized PnL calculation
  let oldUnrealizedETHCost = position.unrealizedETHUnitCost.times(
    position.currentETHAmount
  );

  position.currentETHAmount = position.currentETHAmount.plus(amount);
  position.unrealizedETHUnitCost = oldUnrealizedETHCost
    .plus(amount.times(usdcPrices[1]))
    .div(position.currentETHAmount);

  // Because it will only be used in depositing and withdrawing in short position
  position.positionType = "SHORT";

  position.save();
}

// buy: amount > 0
// sell amount < 0
export function buyOrSellSQTH(userAddr: string, amount: BigDecimal): void {
  let osqthPrices = getoSQTHETHPrice();

  let position = loadOrCreatePosition(userAddr);

  // Sell
  if (amount.lt(ZERO_BD)) {
    let absAmount = amount.neg();

    let oldRealizedOSQTHAmount = position.realizedOSQTHAmount;
    position.realizedOSQTHAmount = position.realizedOSQTHAmount.plus(absAmount);

    let oldRealizedOSQTHGain = position.realizedOSQTHUnitGain.times(
      oldRealizedOSQTHAmount
    );
    position.realizedOSQTHUnitGain = oldRealizedOSQTHGain
      .plus(absAmount.times(osqthPrices[3]))
      .div(position.realizedOSQTHAmount);

    let oldRealizedOSQTHCost = position.realizedOSQTHUnitCost.times(
      oldRealizedOSQTHAmount
    );
    position.realizedOSQTHUnitCost = oldRealizedOSQTHCost
      .plus(amount.times(osqthPrices[3]))
      .div(position.realizedOSQTHAmount);
  }

  // Unrealized PnL calculation
  let oldUnrealizedOSQTHCost = position.unrealizedOSQTHUnitCost.times(
    position.currentOSQTHAmount
  );

  position.currentOSQTHAmount = position.currentOSQTHAmount.plus(amount);
  position.unrealizedOSQTHUnitCost = oldUnrealizedOSQTHCost
    .plus(amount.times(osqthPrices[3]))
    .div(position.currentOSQTHAmount);

  // > 0, long; < 0 short; = 0 none
  if (position.currentOSQTHAmount.gt(ZERO_BD)) {
    position.positionType = "LONG";
  } else if (position.currentOSQTHAmount.lt(ZERO_BD)) {
    position.positionType = "SHORT";
  } else {
    initPosition(userAddr, position);
  }

  position.save();
}

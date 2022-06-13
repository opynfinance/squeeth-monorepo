import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
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
  ZERO_BI,
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

export function loadOrCreateAccount(accountId: string): Account {
  let account = Account.load(accountId);
  // if no account, create new entity
  if (account == null) {
    account = new Account(accountId);
    account.vaultCount = BIGINT_ZERO;
  }
  return account as Account;
}

export function clearPosition(userAddr: string, position: Position): Position {
  position.owner = userAddr;
  position.positionType = "NONE";

  position.unrealizedOSQTHAmount = ZERO_BD;
  position.unrealizedETHAmount = ZERO_BD;
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

export function loadOrCreateLPPosition(userAddr: string): LPPosition {
  let lpPosition = LPPosition.load(userAddr);
  // if no position, create new entity
  if (lpPosition == null) {
    lpPosition = new LPPosition(userAddr);
    lpPosition.owner = userAddr;

    lpPosition.unrealizedOSQTHAmount = ZERO_BD;
    lpPosition.unrealizedETHAmount = ZERO_BD;
    lpPosition.unrealizedOSQTHUnitCost = ZERO_BD;
    lpPosition.unrealizedETHUnitCost = ZERO_BD;

    lpPosition.realizedOSQTHUnitCost = ZERO_BD;
    lpPosition.realizedETHUnitCost = ZERO_BD;
    lpPosition.realizedOSQTHUnitGain = ZERO_BD;
    lpPosition.realizedETHUnitGain = ZERO_BD;
    lpPosition.realizedOSQTHAmount = ZERO_BD;
    lpPosition.realizedETHAmount = ZERO_BD;
  }
  return lpPosition as LPPosition;
}

export function loadOrCreatePosition(userAddr: string): Position {
  let position = Position.load(userAddr);
  // if no position, create new entity
  if (position == null) {
    position = new Position(userAddr);
    position = clearPosition(userAddr, position);
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
    osqthPrices[0].times(usdcPrices[1]),
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
  transactionHistory.oSqthPriceInETH = osqthPrices[1];

  return transactionHistory;
}

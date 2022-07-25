import { BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { Account, Pool, TransactionHistory } from "../generated/schema";
import { OSQTH_WETH_POOL, USDC_WETH_POOL } from "./addresses";
import {
  BIGINT_ZERO,
  BIGINT_ONE,
  BIGDECIMAL_ZERO,
  TOKEN_DECIMALS_USDC,
  TOKEN_DECIMALS_18,
} from "./constants";

export function loadOrCreateAccount(accountId: string): Account {
  let account = Account.load(accountId);
  // if no account, create new entity
  if (account == null) {
    account = new Account(accountId);
    account.vaultCount = BIGINT_ZERO;
  }
  return account as Account;
}

export function exponentToBigDecimal(decimals: BigInt): BigDecimal {
  let bd = BigDecimal.fromString("1");
  for (let i = BIGINT_ZERO; i.lt(decimals as BigInt); i = i.plus(BIGINT_ONE)) {
    bd = bd.times(BigDecimal.fromString("10"));
  }
  return bd;
}

// return 0 if denominator is 0 in division
export function safeDiv(amount0: BigDecimal, amount1: BigDecimal): BigDecimal {
  if (amount1.equals(BIGDECIMAL_ZERO)) {
    return BIGDECIMAL_ZERO;
  } else {
    return amount0.div(amount1);
  }
}

export function convertTokenToDecimal(
  tokenAmount: BigInt,
  exchangeDecimals: BigInt
): BigDecimal {
  if (exchangeDecimals == BIGINT_ZERO) {
    return tokenAmount.toBigDecimal();
  }
  return tokenAmount.toBigDecimal().div(exponentToBigDecimal(exchangeDecimals));
}

export function bigExponent(base: i32, exp: i32): BigInt {
  let base_BI = BigInt.fromI32(base);
  let bd = base_BI;
  for (let i = 1; i < exp; i++) {
    bd = bd.times(base_BI);
  }
  return bd;
}

let Q192 = bigExponent(2, 192);
export function sqrtPriceX96ToTokenPrices(
  sqrtPriceX96: BigInt,
  token0Decimal: BigInt,
  token1Decimal: BigInt
): BigDecimal[] {
  let num = sqrtPriceX96.times(sqrtPriceX96).toBigDecimal();
  let denom = BigDecimal.fromString(Q192.toString());

  let price1 = num
    .div(denom)
    .times(exponentToBigDecimal(token0Decimal))
    .div(exponentToBigDecimal(token1Decimal));

  let price0 = safeDiv(BigDecimal.fromString("1"), price1);
  return [price0, price1];
}

export function getEthUsdcPrices(): BigDecimal[] {
  let usdcPool = Pool.load(USDC_WETH_POOL);
  if (usdcPool == null) {
    return [BIGDECIMAL_ZERO, BIGDECIMAL_ZERO, BIGDECIMAL_ZERO];
  }
  let usdcPrices = sqrtPriceX96ToTokenPrices(
    usdcPool.sqrtPrice,
    TOKEN_DECIMALS_USDC,
    TOKEN_DECIMALS_18
  );

  return [usdcPool.sqrtPrice.toBigDecimal(), usdcPrices[0], usdcPrices[1]];
}

export function getSqthEthPrices(): BigDecimal[] {
  let osqthPool = Pool.load(OSQTH_WETH_POOL);
  let usdcPrices = getEthUsdcPrices();

  if (osqthPool == null) {
    return [BIGDECIMAL_ZERO, BIGDECIMAL_ZERO, BIGDECIMAL_ZERO, BIGDECIMAL_ZERO];
  }

  let sqthPrices = sqrtPriceX96ToTokenPrices(
    osqthPool.sqrtPrice,
    TOKEN_DECIMALS_18,
    TOKEN_DECIMALS_18
  );

  return [
    osqthPool.sqrtPrice.toBigDecimal(),
    sqthPrices[0],
    sqthPrices[1],
    sqthPrices[1].times(usdcPrices[1]),
  ];
}

export function createTransactionHistory(transactionType: string, event: ethereum.Event): TransactionHistory {
  let transactionHistory = new TransactionHistory(
    `${event.transaction.hash.toHex()}-${transactionType}`
  );
  transactionHistory.owner = event.transaction.from;
  transactionHistory.timestamp = event.block.timestamp;
  transactionHistory.transactionType = transactionType;
  transactionHistory.sqthAmount = BIGDECIMAL_ZERO;
  transactionHistory.ethAmount = BIGDECIMAL_ZERO;
  transactionHistory.sqthPrice = getSqthEthPrices()[3]
  transactionHistory.ethPrice = getEthUsdcPrices()[1]

  return transactionHistory
}

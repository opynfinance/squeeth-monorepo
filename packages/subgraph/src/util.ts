import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Account } from "../generated/schema";
import { BIGINT_ZERO, BIGINT_ONE, BIGDECIMAL_ZERO } from "./constants";

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

export function resetPrices(userAddr: string) {
  let account = loadOrCreateAccount(userAddr);

  account.sqthOpenAmount = BIGDECIMAL_ZERO;
  account.sqthOpenUnitPrice = BIGDECIMAL_ZERO;
  account.sqthCloseAmount = BIGDECIMAL_ZERO;
  account.sqthCloseUnitPrice = BIGDECIMAL_ZERO;
  account.ethDepositAmount = BIGDECIMAL_ZERO;
  account.ethDepositUnitPrice = BIGDECIMAL_ZERO;
  account.ethWithdrawAmount = BIGDECIMAL_ZERO;
  account.ethWitdhrawUnitPrice = BIGDECIMAL_ZERO;

  account.save();
}

export function sqthChange(userAddr: string, amount: BigDecimal) {
  let account = loadOrCreateAccount(userAddr);

  let sqthAmount = account.sqthOpenAmount.plus(account.sqthCloseAmount);
  let newSqthAmount = sqthAmount.plus(amount);

  if (newSqthAmount.equals(BIGDECIMAL_ZERO)) {
    resetPrices(userAddr);
    return;
  }

  if (sqthAmount.times(newSqthAmount).lt(BIGDECIMAL_ZERO)) {
    resetPrices(userAddr);
    sqthChange(userAddr, newSqthAmount);
    return;
  }

  // Open
  if (sqthAmount.times(amount).gt(BIGDECIMAL_ZERO)) {
    let oldSqthOpenAmount = account.sqthOpenAmount;
    let oldSqthOpenUnitPrice = account.sqthOpenUnitPrice;

    // account.sqthOpenAmount = oldSqthOpenAmount.plus(amount);
    // account.sqthOpenUnitPrice = oldSqthOpenUnitPrice
    //   .times(oldSqthOpenAmount)
    //   .plus();
  }
}

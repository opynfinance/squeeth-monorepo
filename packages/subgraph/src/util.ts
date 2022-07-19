import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Account, Pool } from "../generated/schema";
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

export function resetPrices(userAddr: string): void {
  let account = loadOrCreateAccount(userAddr);

  account.sqthOpenAmount = BIGDECIMAL_ZERO;
  account.sqthOpenUnitPrice = BIGDECIMAL_ZERO;
  account.sqthCloseAmount = BIGDECIMAL_ZERO;
  account.sqthCloseUnitPrice = BIGDECIMAL_ZERO;
  account.ethDepositAmount = BIGDECIMAL_ZERO;
  account.ethDepositUnitPrice = BIGDECIMAL_ZERO;
  account.ethWithdrawAmount = BIGDECIMAL_ZERO;
  account.ethWithdrawUnitPrice = BIGDECIMAL_ZERO;

  account.save();
}

export function sqthChange(userAddr: string, amount: BigDecimal): void {
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

  let sqthPrices = getSqthEthPrices();

  // Open
  if (sqthAmount.times(amount).ge(BIGDECIMAL_ZERO)) {
    let oldSqthOpenAmount = account.sqthOpenAmount;
    let oldSqthOpenUnitPrice = account.sqthOpenUnitPrice;

    account.sqthOpenAmount = oldSqthOpenAmount.plus(amount);
    account.sqthOpenUnitPrice = oldSqthOpenUnitPrice
      .times(oldSqthOpenAmount)
      .plus(amount.times(sqthPrices[3]))
      .div(oldSqthOpenAmount.plus(amount));
  }

  // Close
  if (sqthAmount.times(amount).lt(BIGDECIMAL_ZERO)) {
    let oldSqthCloseAmount = account.sqthCloseAmount;
    let oldSqthCloseUnitPrice = account.sqthCloseUnitPrice;

    account.sqthCloseAmount = oldSqthCloseAmount.plus(amount);
    account.sqthCloseUnitPrice = oldSqthCloseUnitPrice
      .times(oldSqthCloseAmount)
      .plus(amount.times(sqthPrices[3]))
      .div(oldSqthCloseAmount.plus(amount));
  }

  account.save();
}

export function ethChange(userAddr: string, amount: BigDecimal): void {
  let account = loadOrCreateAccount(userAddr);
  let usdcPrices = getEthUsdcPrices();

  // Deposit
  if (amount.gt(BIGDECIMAL_ZERO)) {
    let oldEthDepositAmount = account.ethDepositAmount;
    let oldEthDepositUnitPrice = account.ethDepositUnitPrice;

    account.ethDepositAmount = oldEthDepositAmount.plus(amount);
    account.ethDepositUnitPrice = oldEthDepositUnitPrice
      .times(oldEthDepositAmount)
      .plus(amount.times(usdcPrices[0]))
      .div(oldEthDepositAmount.plus(amount));
  }

  // Withdraw
  if (amount.lt(BIGDECIMAL_ZERO)) {
    let oldEthWithdrawAmount = account.ethWithdrawAmount;
    let oldEthWithdrawUnitPrice = account.ethWithdrawUnitPrice;

    account.ethWithdrawAmount = oldEthWithdrawAmount.plus(amount);
    account.ethWithdrawUnitPrice = oldEthWithdrawUnitPrice
      .times(oldEthWithdrawAmount)
      .plus(amount.times(usdcPrices[0]))
      .div(oldEthWithdrawAmount.plus(amount));
  }

  account.save();
}

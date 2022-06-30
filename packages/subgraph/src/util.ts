import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { ethereum } from "@graphprotocol/graph-ts";
import { Pool, TransactionHistory } from "../generated/schema";
import { ZERO_BD, TOKEN_DECIMALS_USDC, TOKEN_DECIMALS_18 } from "./constants";
import { USDC_WETH_POOL, OSQTH_WETH_POOL } from "./addresses";
import {
  handleETHChange,
  handleLPETHChange,
  handleLPOSQTHChange,
  handleOSQTHChange,
} from "./utils/handler";
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
  transactionHistory.oSqthAmount = BigDecimal.zero();
  transactionHistory.ethAmount = BigDecimal.zero();
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

  handleETHChange(userAddr, amount, usdcPrices[1]);
}

export function buyOrSellSQTH(userAddr: string, amount: BigDecimal): void {
  let osqthPrices = getoSQTHETHPrice();

  handleOSQTHChange(userAddr, amount, osqthPrices[3]);
}

// buy: amount > 0
// sell amount < 0
export function buyOrSellLPETH(userAddr: string, amount: BigDecimal): void {
  let usdcPrices = getETHUSDCPrice();

  handleLPETHChange(userAddr, amount, usdcPrices[1]);
}

// buy: amount > 0
// sell amount < 0
export function buyOrSellLPSQTH(userAddr: string, amount: BigDecimal): void {
  let osqthPrices = getoSQTHETHPrice();

  handleLPOSQTHChange(userAddr, amount, osqthPrices[3]);
}

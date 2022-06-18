/* eslint-disable prefer-const */
import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { exponentToBigDecimal, safeDiv } from "../utils/index";
import { bigExponent } from "../util";

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

/* eslint-disable prefer-const */
import { TOKEN_DECIMALS } from "../constants";
import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { exponentToBigDecimal, safeDiv } from "../utils/index";

let Q192 = 2 ** 192;
export function sqrtPriceX96ToTokenPrices(sqrtPriceX96: BigInt): BigDecimal[] {
  let num = sqrtPriceX96.times(sqrtPriceX96).toBigDecimal();
  let denom = BigDecimal.fromString(Q192.toString());

  let price1 = safeDiv(num, denom)
    .times(exponentToBigDecimal(TOKEN_DECIMALS))
    .div(exponentToBigDecimal(TOKEN_DECIMALS));

  let price0 = safeDiv(BigDecimal.fromString("1"), price1);
  return [price0, price1];
}

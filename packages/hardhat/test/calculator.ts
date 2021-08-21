import { BigNumber } from "bignumber.js"

export function convertPriceToSqrtX96 (sqrtPriceX96: string) {

  return new BigNumber(sqrtPriceX96).times(sqrtPriceX96).times(1e18).div(new BigNumber(2).pow(96 * 2))
  
}

/**
 * token0: USD
 * token1: ETH
 * @param sqrtPriceX96 
 * @returns price of token1 per token0. scaled by 1e18
 */
function convertSqrtX96ToRawPrice (sqrtPriceX96: string) {
  const priceToken1InToken0 = new BigNumber(sqrtPriceX96).times(sqrtPriceX96).times(1e18).div(new BigNumber(2).pow(96 * 2))
  // price = sqrtPriceX96 * sqrtPriceX96 * 1e18 >> (96 * 2)
  return priceToken1InToken0
}

/**
 * token0: USD
 * token1: ETH
 * @param sqrtPriceX96 
 * @returns price of token1 per token0. scaled by 1e18
 */
 function convertRawPriceToSqrtX96 (rawPrice: BigNumber) {
  const sqrtX96Price = rawPrice.times(new BigNumber(2).pow(96 * 2)).div(1e18).squareRoot()
  return sqrtX96Price
}

export function convertSqrtX96ToEthPrice(sqrtPriceX96: string) {
  const rawPrice = convertSqrtX96ToRawPrice(sqrtPriceX96)
  return new BigNumber(1e18).div(rawPrice)
}

/**
 * convert human readable eth price to sqrtX96. 
 * Assuming token0 is USD and token1 is ETH.
 * @param ethPriceInUSD 
 */
export function convertNormalPriceToSqrtX96Price(ethPriceInUSD: string) {
  const rawPrice = new BigNumber(1e18).div(ethPriceInUSD)
  return convertRawPriceToSqrtX96(rawPrice)
}
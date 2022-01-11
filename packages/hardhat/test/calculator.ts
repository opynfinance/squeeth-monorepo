import { BigNumberish } from "ethers"
import { BigNumber } from "bignumber.js"

export function convertPriceToSqrtX96 (sqrtPriceX96: string) {

  return new BigNumber(sqrtPriceX96).times(sqrtPriceX96).times(1e18).div(new BigNumber(2).pow(96 * 2))
  
}

// /**
//  * token0: USD
//  * token1: ETH
//  * @param sqrtPriceX96 
//  * @returns price of token1 per token0. scaled by 1e18
//  */
// function convertSqrtX96ToRawPrice (sqrtPriceX96: string) {
//   const priceToken1InToken0 = new BigNumber(sqrtPriceX96).times(sqrtPriceX96).times(1e18).div(new BigNumber(2).pow(96 * 2))
//   // price = sqrtPriceX96 * sqrtPriceX96 * 1e18 >> (96 * 2)
//   return priceToken1InToken0
// }

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

export function convertToken1PriceToSqrtX96Price(token1PriceInToken0: string) {
  const rawPrice = new BigNumber(1e18).div(token1PriceInToken0)
  return convertRawPriceToSqrtX96(rawPrice)
}

export function convertToken0PriceToSqrtX96Price(token1PriceInToken0: string) {
  const rawPrice = new BigNumber(token1PriceInToken0).times(1e18)
  return convertRawPriceToSqrtX96(rawPrice)
}

export function getTickFromToken0Price(price: string) {
  return log1_0001(new BigNumber(price).toNumber())
}

export function getTickFromNormalPrice(price: string) {
  return log1_0001(new BigNumber(1).div(price).toNumber())
}

function log1_0001(num: number) { // eslint-disable-line
  return Math.log2(num) / Math.log2(1.0001)
}

export function getSqrtPriceAndTickBySqueethPrice(price1e18: string|BigNumberish, wethIsToken0: boolean) {
  const humanReadablePrice = new BigNumber(price1e18.toString()).div(1e18)
  const newToken0Price = wethIsToken0 
    ? new BigNumber(1).div(humanReadablePrice).toString()
    : humanReadablePrice 
  const sqrtPrice = convertToken0PriceToSqrtX96Price(newToken0Price.toString()).toFixed(0)
  const tick =  getTickFromToken0Price(newToken0Price.toString()).toFixed(0)
  return { tick, sqrtPrice }
}

export function getYAmountAboveRange (pa:number, pb: number, liquidity: string) {
  const sqrtA = new BigNumber(pa).squareRoot()
  const sqrtB = new BigNumber(pb).squareRoot()
  return new BigNumber(liquidity).times(sqrtB.minus(sqrtA)).integerValue()
}

export function getXAmountBelowRange (pa:number, pb: number, liquidity: string) {
  const sqrtA = new BigNumber(pa).squareRoot()
  const sqrtB = new BigNumber(pb).squareRoot()
  return new BigNumber(liquidity).times(sqrtB.minus(sqrtA)).div(sqrtB.times(sqrtA)).integerValue()
}

export function tickToPrice1e18(tick: number) {
  // calculate x = 1.0001 ^ tick
  return new BigNumber(1.0001).pow(tick).times(1e18).toFixed(0)
}
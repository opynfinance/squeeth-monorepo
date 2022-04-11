/* eslint-disable prettier/prettier */
import { CurrencyAmount, MaxUint256, Price, Token } from '@uniswap/sdk-core';
import { nearestUsableTick, Pool, Position, priceToClosestTick } from '@uniswap/v3-sdk'
import { fromTokenAmount, toTokenAmount } from './calculations';

export const getPositionFromAmounts = (pool: Pool,
  tickLower: number,
  tickUpper: number,
  wethAmount: number,
  sqthAmount: number,
  isWethToken0: boolean,) => {

  let [amount0, amount1] = [sqthAmount, wethAmount]
  if (isWethToken0) {
    [tickLower, tickUpper] = [tickUpper, tickLower];
    [amount0, amount1] = [wethAmount, sqthAmount] // swap
  }

  const pos = Position.fromAmounts({
    pool,
    tickLower,
    tickUpper,
    amount0: amount0 ? fromTokenAmount(amount0, pool.token0.decimals).toString() : MaxUint256,
    amount1: amount1 ? fromTokenAmount(amount1, pool.token1.decimals).toString() : MaxUint256,
    useFullPrecision: false
  })

  return pos
}

export const calculateLPAmounts = (
  pool: Pool,
  tickLower: number,
  tickUpper: number,
  wethAmount: number,
  sqthAmount: number,
  isWethToken0: boolean,
) => {
  if (wethAmount === 0 && sqthAmount === 0) return [wethAmount, sqthAmount]

  const pos = getPositionFromAmounts(pool, tickLower, tickUpper, wethAmount, sqthAmount, isWethToken0)

  const newAmount0 = parseFloat(pos.amount0.toFixed(8))
  const newAmount1 = parseFloat(pos.amount1.toFixed(8))

  if (isWethToken0) return [newAmount0, newAmount1]

  return [newAmount1, newAmount0]
}

export const calculateTickForPrice = (price: number, quoteToken: Token, baseToken: Token, tickSpacing: number) => {
  if (price === 0) {
    return
  }

  const _price = new Price({
    quoteAmount: CurrencyAmount.fromRawAmount(quoteToken, Math.ceil(price * Math.pow(10, quoteToken.decimals))),
    baseAmount: CurrencyAmount.fromRawAmount(baseToken, Math.ceil(1 * Math.pow(10, baseToken.decimals))),
  })

  const tickFromPrice = priceToClosestTick(_price)
  const closestTick = nearestUsableTick(tickFromPrice, tickSpacing)

  return closestTick
}
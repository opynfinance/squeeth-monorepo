/* eslint-disable prettier/prettier */
import { MaxUint256 } from '@uniswap/sdk-core';
import { Pool, Position } from '@uniswap/v3-sdk'
import { fromTokenAmount, toTokenAmount } from './calculations';

export const calculateLPAmounts = (
  pool: Pool,
  tickLower: number,
  tickUpper: number,
  wethAmount: number,
  sqthAmount: number,
  isWethToken0: boolean,
) => {
  if (wethAmount === 0 && sqthAmount === 0) return [wethAmount, sqthAmount]

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

  const newAmount0 = parseFloat(pos.amount0.toFixed(6))
  const newAmount1 = parseFloat(pos.amount1.toFixed(6))

  if (isWethToken0) return [newAmount0, newAmount1]

  return [newAmount1, newAmount0]
}

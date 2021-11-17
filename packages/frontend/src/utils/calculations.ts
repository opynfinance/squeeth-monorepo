import { Pool } from '@uniswap/v3-sdk'
import BigNumber from 'bignumber.js'

export function toTokenAmount(amount: BigNumber | number | string, decimals: number): BigNumber {
  return new BigNumber(amount).div(new BigNumber(10).exponentiatedBy(decimals))
}

export function fromTokenAmount(amount: BigNumber | number | string, decimals: number): BigNumber {
  return new BigNumber(amount).times(new BigNumber(10).exponentiatedBy(decimals))
}

export function inRange(lower: number, upper: number, pool: Pool | undefined): boolean {
  if (!pool) {
    return false
  }
  return upper > pool?.tickCurrent && pool?.tickCurrent > lower
}

import { Percent } from '@uniswap/sdk-core'
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

export function parseSlippageInput(value: string) {
  const parsed = Math.floor(Number.parseFloat(value) * 10)

  if (value.length === 0 || !Number.isInteger(parsed) || parsed < 0 || parsed > 5000) {
    return new Percent(5, 10_000)
  } else {
    return new Percent(parsed, 10_000)
  }
}

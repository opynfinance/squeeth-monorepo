import { Percent } from '@uniswap/sdk-core'
import { Pool } from '@uniswap/v3-sdk'
import BigNumber from 'bignumber.js'

import { DEFAULT_SLIPPAGE } from '../constants'
import { CollateralStatus } from '../types'

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
  const parsed = Math.floor(Number.parseFloat(value) * 100)

  if (value.length === 0 || !Number.isInteger(parsed) || parsed < 0 || parsed > 5000) {
    const defaultSlippage = DEFAULT_SLIPPAGE * 100 //Percent(50, 10_000) = 0.5%
    return new Percent(defaultSlippage, 10_000)
  } else {
    return new Percent(parsed, 10_000)
  }
}

export function getCollatPercentStatus(collatPercent: number) {
  if (collatPercent < 200) return CollateralStatus.DANGER
  if (collatPercent < 225) return CollateralStatus.RISKY
  return CollateralStatus.SAFE
}

export const mergeQuery = (existing = [], incoming: any[]) => {
  return incoming.length === 0 ? existing : incoming
}

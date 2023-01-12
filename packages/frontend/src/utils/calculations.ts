import { Percent } from '@uniswap/sdk-core'
import { Pool } from '@uniswap/v3-sdk'
import BigNumber from 'bignumber.js'

import { BIG_ZERO, DEFAULT_SLIPPAGE, ETH_USDC_POOL_FEES, FUNDING_PERIOD, UNI_POOL_FEES } from '../constants'
import { CollateralStatus, Networks } from '../types'

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

/**
 * For the given params it returns breakeven ETH price.
 *
 * Calculation is done with the help of https://docs.google.com/spreadsheets/d/1k1Y_WZ4Of9Prsn5hpHX2BXfdPuUg24X_KBrgYvV8Yw4/edit#gid=0
 */
export function getBreakEvenForLongSqueeth(
  markPrice: BigNumber,
  indexPrice: BigNumber,
  normFactor: BigNumber,
  days: number,
) {
  const markToIndexRatio = markPrice.div(indexPrice)
  const indexToMarkRatio = indexPrice.div(markPrice)

  const newNormFactor = normFactor.toNumber() * Math.pow(indexToMarkRatio.toNumber(), days / FUNDING_PERIOD)
  console.log(newNormFactor, markToIndexRatio.toString(), toTokenAmount(markPrice, 18).toString())
  const breakEven = Math.sqrt(toTokenAmount(indexPrice, 18).multipliedBy(normFactor).div(newNormFactor).toNumber())
  return breakEven
}

export function getUSDCPoolFee(network: Networks) {
  return network === Networks.GOERLI ? UNI_POOL_FEES : ETH_USDC_POOL_FEES
}

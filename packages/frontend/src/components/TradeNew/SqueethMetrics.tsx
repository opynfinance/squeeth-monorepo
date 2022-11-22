import React from 'react'
import { Box, BoxProps } from '@material-ui/core'
import { useAtomValue } from 'jotai'

import {
  normFactorAtom,
  impliedVolAtom,
  indexAtom,
  markAtom,
  osqthRefVolAtom,
  dailyHistoricalFundingAtom,
  currentImpliedFundingAtom,
} from '@state/controller/atoms'
import { toTokenAmount } from '@utils/calculations'
import { formatCurrency, formatNumber } from '@utils/formatter'
import { useOSQTHPrice } from '@hooks/useOSQTHPrice'
import Metric from './Metric'

const SqueethMetrics: React.FC<BoxProps> = (props) => {
  const index = useAtomValue(indexAtom)
  const mark = useAtomValue(markAtom)
  const impliedVol = useAtomValue(impliedVolAtom)
  const osqthRefVol = useAtomValue(osqthRefVolAtom)
  const osqthPrice = useOSQTHPrice()
  const normFactor = useAtomValue(normFactorAtom)
  const currentImpliedFunding = useAtomValue(currentImpliedFundingAtom)
  const dailyHistoricalFunding = useAtomValue(dailyHistoricalFundingAtom)

  const eth2Price = toTokenAmount(index, 18)
  const ethPrice = eth2Price.sqrt()
  const markPrice = toTokenAmount(mark, 18)
  const impliedVolPercent = impliedVol * 100
  const osqthPriceInETH = osqthPrice.div(ethPrice)
  const currentImpliedPremium =
    currentImpliedFunding === 0 ? 'loading' : formatNumber(currentImpliedFunding * 100) + '%'
  const historicalDailyPremium =
    dailyHistoricalFunding.funding === 0 ? 'loading' : formatNumber(dailyHistoricalFunding.funding * 100) + '%'

  return (
    <Box display="flex" alignItems="center" flexWrap="wrap" gridGap="12px" {...props}>
      <Metric label="ETH Price" value={formatCurrency(ethPrice.toNumber())} />

      <Metric label="Current Implied Premium" value={currentImpliedPremium} />

      <Metric label="Historical Daily Premium" value={historicalDailyPremium} />

      <Metric label="ETH&sup2; Price" value={formatCurrency(eth2Price.toNumber())} />

      <Metric label="Mark Price" value={formatCurrency(markPrice.toNumber())} />

      <Metric label="Implied Volatility" value={`${formatNumber(impliedVolPercent)}%`} />

      <Metric label="Reference Vol." value={`${formatNumber(osqthRefVol)}%`} />

      <Metric label="oSQTH Price (ETH)" value={`${formatNumber(osqthPriceInETH.toNumber(), 4)} Ξ`} />

      <Metric label="oSQTH Price (USD)" value={formatCurrency(osqthPrice.toNumber())} />

      <Metric label="Norm Factor" value={formatNumber(normFactor.toNumber(), 4)} />
    </Box>
  )
}

export default SqueethMetrics

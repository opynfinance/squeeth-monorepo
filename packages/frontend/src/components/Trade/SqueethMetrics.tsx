import React from 'react'
import { Box, BoxProps } from '@material-ui/core'
import { useAtomValue } from 'jotai'

import {
  normFactorAtom,
  impliedVolAtom,
  markAtom,
  osqthRefVolAtom,
  dailyHistoricalFundingAtom,
  currentImpliedFundingAtom,
} from '@state/controller/atoms'
import { toTokenAmount } from '@utils/calculations'
import { formatCurrency, formatNumber } from '@utils/formatter'
import Metric, { MetricLabel } from '@components/Metric'
import { Tooltips } from '@constants/enums'
import { useOnChainETHPrice } from '@hooks/useETHPrice'

const SqueethMetrics: React.FC<BoxProps> = (props) => {
  const mark = useAtomValue(markAtom)
  const impliedVol = useAtomValue(impliedVolAtom)
  const osqthRefVol = useAtomValue(osqthRefVolAtom)
  const normFactor = useAtomValue(normFactorAtom)
  const currentImpliedFunding = useAtomValue(currentImpliedFundingAtom)
  const dailyHistoricalFunding = useAtomValue(dailyHistoricalFundingAtom)

  const ethPrice = useOnChainETHPrice()
  const eth2Price = ethPrice.exponentiatedBy(2)
  const markPrice = toTokenAmount(mark, 18)
  const impliedVolPercent = impliedVol * 100
  const currentImpliedPremium =
    currentImpliedFunding === 0 ? 'loading' : formatNumber(currentImpliedFunding * 100) + '%'
  const historicalDailyPremium =
    dailyHistoricalFunding.funding === 0 ? 'loading' : formatNumber(dailyHistoricalFunding.funding * 100) + '%'

  return (
    <Box display="flex" alignItems="center" flexWrap="wrap" gridGap="12px" {...props}>
      <Metric
        label={<MetricLabel label="ETH Price" tooltipTitle={Tooltips.SpotPrice} />}
        value={formatCurrency(ethPrice.toNumber())}
      />

      <Metric
        label={<MetricLabel label="ETH&sup2; Price" tooltipTitle={Tooltips.SpotPrice} />}
        value={formatCurrency(eth2Price.toNumber())}
      />

      <Metric
        label={<MetricLabel label="Mark Price" tooltipTitle={Tooltips.Mark} />}
        value={formatCurrency(markPrice.toNumber())}
      />

      <Metric
        label={<MetricLabel label="Implied Volatility" tooltipTitle={Tooltips.ImplVol} />}
        value={`${formatNumber(impliedVolPercent)}%`}
      />

      <Metric
        label={<MetricLabel label="Reference Volatility" tooltipTitle={Tooltips.osqthRefVol} />}
        value={`${formatNumber(osqthRefVol)}%`}
      />

      <Metric
        label={<MetricLabel label="Norm Factor" tooltipTitle={Tooltips.NormFactor} />}
        value={formatNumber(normFactor.toNumber(), 4)}
      />

      <Metric
        label={<MetricLabel label="Current Implied Premium" tooltipTitle={Tooltips.CurrentImplFunding} />}
        value={currentImpliedPremium}
      />

      <Metric
        label={
          <MetricLabel
            label="Historical Daily Premium"
            tooltipTitle={`Historical daily premium based on the last ${dailyHistoricalFunding.period} hours. Calculated using a ${dailyHistoricalFunding.period} hour TWAP of Mark - Index`}
          />
        }
        value={historicalDailyPremium}
      />
    </Box>
  )
}

export default SqueethMetrics

import React from 'react'
import { Box } from '@material-ui/core'
import { useAtomValue } from 'jotai'

import Metric, { MetricLabel } from '@components/Metric'
import { formatNumber, formatCurrency } from '@utils/formatter'
import { toTokenAmount } from '@utils/calculations'
import { Tooltips } from '@constants/enums'
import { currentImpliedFundingAtom, dailyHistoricalFundingAtom } from '@state/controller/atoms'
import { useSetProfitableMovePercentV2 } from '@state/crab/hooks'
import { ethPriceAtLastHedgeAtomV2, timeAtLastHedgeAtomV2, crabStrategyCollatRatioAtomV2 } from '@state/crab/atoms'
import { useOnChainETHPrice } from '@hooks/useETHPrice'

const CrabMetricsV2: React.FC = () => {
  const ethPrice = useOnChainETHPrice()
  const currentImpliedFunding = useAtomValue(currentImpliedFundingAtom)
  const dailyHistoricalFunding = useAtomValue(dailyHistoricalFundingAtom)
  const timeAtLastHedge = useAtomValue(timeAtLastHedgeAtomV2)
  const ethPriceAtLastHedgeValue = useAtomValue(ethPriceAtLastHedgeAtomV2)
  const collatRatio = useAtomValue(crabStrategyCollatRatioAtomV2)

  const profitableMovePercentV2 = useSetProfitableMovePercentV2()
  const ethPriceAtLastHedge = Number(toTokenAmount(ethPriceAtLastHedgeValue, 18))
  const lowerPriceBandForProfitability = ethPriceAtLastHedge - profitableMovePercentV2 * ethPriceAtLastHedge
  const upperPriceBandForProfitability = ethPriceAtLastHedge + profitableMovePercentV2 * ethPriceAtLastHedge

  return (
    <Box display="flex" alignItems="center" flexWrap="wrap" gridGap="12px" marginTop="32px">
      <Metric
        flexBasis="250px"
        label={<MetricLabel label="ETH Price" tooltipTitle={Tooltips.SpotPrice} />}
        value={formatCurrency(ethPrice.toNumber())}
      />
      <Metric
        flexBasis="250px"
        label={
          <MetricLabel
            label="Current Implied Premium"
            tooltipTitle={`${Tooltips.StrategyEarnFunding}. ${Tooltips.CurrentImplFunding}`}
          />
        }
        value={formatNumber(currentImpliedFunding * 100) + '%'}
      />
      <Metric
        flexBasis="250px"
        label={
          <MetricLabel
            label="Historical Daily Premium"
            tooltipTitle={`${
              Tooltips.StrategyEarnFunding
            }. ${`Historical daily premium based on the last ${dailyHistoricalFunding.period} hours. Calculated using a ${dailyHistoricalFunding.period} hour TWAP of Mark - Index`}`}
          />
        }
        value={formatNumber(dailyHistoricalFunding.funding * 100) + '%'}
      />
      <Metric
        flexBasis="250px"
        label={
          <MetricLabel
            label="Last hedged at"
            tooltipTitle={
              'Last hedged at ' +
              new Date(timeAtLastHedge * 1000).toLocaleString(undefined, {
                day: 'numeric',
                month: 'long',
                hour: 'numeric',
                minute: 'numeric',
                timeZoneName: 'long',
              }) +
              '. Hedges approximately 3 times a week (on MWF) or every 20% ETH price move'
            }
          />
        }
        value={new Date(timeAtLastHedge * 1000).toLocaleString(undefined, {
          day: 'numeric',
          month: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
        })}
      />
      <Metric
        flexBasis="250px"
        label={
          <MetricLabel
            label={`Approx Profitable (${formatNumber(profitableMovePercentV2 * 100)}%)`}
            tooltipTitle={Tooltips.StrategyProfitThreshold}
          />
        }
        value={formatCurrency(lowerPriceBandForProfitability) + ' - ' + formatCurrency(upperPriceBandForProfitability)}
      />
      <Metric
        flexBasis="250px"
        label={<MetricLabel label="Collateralization Ratio" tooltipTitle={Tooltips.StrategyCollRatio} />}
        value={formatNumber(collatRatio === Infinity ? 0 : collatRatio) + '%'}
      />
    </Box>
  )
}

export default CrabMetricsV2

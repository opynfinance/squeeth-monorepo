import React from 'react'
import { Typography, Box, Tooltip } from '@material-ui/core'
import { Tooltips } from '@constants/enums'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import { createStyles, makeStyles } from '@material-ui/core/styles'

import Metric from '@components/Metric'
import { useAtomValue } from 'jotai'
import { bullCRAtom, bullCurrentFundingAtom, bullTimeAtLastHedgeAtom } from '@state/bull/atoms'
import { dailyHistoricalFundingAtom } from '@state/controller/atoms'
import { formatCurrency, formatNumber } from '@utils/formatter'
import { useOnChainETHPrice } from '@hooks/useETHPrice'
import { crabStrategyCollatRatioAtomV2 } from '@state/crab/atoms'

const useLabelStyles = makeStyles((theme) =>
  createStyles({
    labelContainer: {
      display: 'flex',
      alignItems: 'center',
      color: 'rgba(255, 255, 255, 0.5)',
    },
    label: {
      fontSize: '15px',
      fontWeight: 500,
      width: 'max-content',
    },
    infoIcon: {
      fontSize: '15px',
      marginLeft: theme.spacing(0.5),
    },
  }),
)

const Label: React.FC<{ label: string; tooltipTitle: string }> = ({ label, tooltipTitle }) => {
  const classes = useLabelStyles()

  return (
    <div className={classes.labelContainer}>
      <Typography className={classes.label}>{label}</Typography>
      <Tooltip title={tooltipTitle}>
        <InfoIcon fontSize="small" className={classes.infoIcon} />
      </Tooltip>
    </div>
  )
}

type BullMetricsType = {
  lowerPriceBandForProfitability: number
  upperPriceBandForProfitability: number
}

const BullStrategyMetrics: React.FC<BullMetricsType> = ({
  lowerPriceBandForProfitability,
  upperPriceBandForProfitability,
}) => {
  const ethPrice = useOnChainETHPrice()
  const bullCr = useAtomValue(bullCRAtom).times(100)
  const crabCr = useAtomValue(crabStrategyCollatRatioAtomV2)
  const dailyHistoricalFunding = useAtomValue(dailyHistoricalFundingAtom)
  const currentImpliedFunding = useAtomValue(bullCurrentFundingAtom)
  const timeAtLastHedge = useAtomValue(bullTimeAtLastHedgeAtom)

  return (
    <Box display="flex" alignItems="center" flexWrap="wrap" gridGap="12px">
      <Metric
        flexBasis="250px"
        label={<Label label="ETH Price" tooltipTitle={Tooltips.SpotPrice} />}
        value={formatCurrency(ethPrice.toNumber())}
      />
      <Metric
        flexBasis="250px"
        label={
          <Label
            label="Current Implied Premium"
            tooltipTitle={`${Tooltips.StrategyEarnFunding}. ${Tooltips.CurrentImplFunding}`}
          />
        }
        value={
          currentImpliedFunding && currentImpliedFunding != Infinity
            ? `${formatNumber(currentImpliedFunding * 100)}%`
            : '-'
        }
      />
      <Metric
        flexBasis="250px"
        label={
          <Label
            label="Historical Daily Premium"
            tooltipTitle={`${
              Tooltips.StrategyEarnFunding
            }. ${`Historical daily premium based on the last ${dailyHistoricalFunding.period} hours. Calculated using a ${dailyHistoricalFunding.period} hour TWAP of Mark - Index`}`}
          />
        }
        value={`${formatNumber(dailyHistoricalFunding.funding * 100)}%`}
      />
      <Metric
        flexBasis="250px"
        label={
          <Label
            label="Last rebalance"
            tooltipTitle={
              'Last rebalanced at ' +
              new Date(timeAtLastHedge * 1000).toLocaleString(undefined, {
                day: 'numeric',
                month: 'long',
                hour: 'numeric',
                minute: 'numeric',
                timeZoneName: 'long',
              }) +
              '. Rebalances approximately 3 times a week (on MWF) or every 20% ETH price move'
            }
          />
        }
        value={
          timeAtLastHedge
            ? new Date(timeAtLastHedge * 1000).toLocaleString(undefined, {
                day: 'numeric',
                month: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
              })
            : '--'
        }
      />
      <Metric
        flexBasis="250px"
        label={<Label label="Stack ETH if between" tooltipTitle={Tooltips.BullStrategyProfitThreshold} />}
        value={
          lowerPriceBandForProfitability && lowerPriceBandForProfitability != Infinity
            ? formatCurrency(lowerPriceBandForProfitability) + ' - ' + formatCurrency(upperPriceBandForProfitability)
            : '-'
        }
      />
      <Metric
        flexBasis="250px"
        label={<Label label="Collateralization Ratio" tooltipTitle={Tooltips.StrategyCollRatio} />}
        value={`${(bullCr.lt(crabCr) ? bullCr : crabCr).toFixed(0)}%`}
      />
    </Box>
  )
}

export default BullStrategyMetrics

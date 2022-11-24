import React from 'react'
import { Typography, Box, Tooltip } from '@material-ui/core'
import { Tooltips } from '@constants/enums'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import { createStyles, makeStyles } from '@material-ui/core/styles'

import Metric from '@components/Metric'
import { useAtomValue } from 'jotai'
import { bullCRAtom } from '@state/bull/atoms'
import { crabStrategyCollatRatioAtomV2 } from '@state/crab/atoms'
import { currentImpliedFundingAtom, dailyHistoricalFundingAtom } from '@state/controller/atoms'
import { formatNumber } from '@utils/formatter'

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

const BullStrategyMetrics: React.FC = () => {
  const bullCr = useAtomValue(bullCRAtom).times(100)
  const crabCr = useAtomValue(crabStrategyCollatRatioAtomV2)
  const dailyHistoricalFunding = useAtomValue(dailyHistoricalFundingAtom)
  const currentImpliedFunding = useAtomValue(currentImpliedFundingAtom)

  return (
    <Box display="flex" alignItems="center" flexWrap="wrap" gridGap="12px">
      <Metric
        flexBasis="250px"
        label={<Label label="ETH Price" tooltipTitle={Tooltips.SpotPrice} />}
        value={`$1,119.07`}
      />
      <Metric
        flexBasis="250px"
        label={
          <Label
            label="Current Implied Premium"
            tooltipTitle={`${Tooltips.StrategyEarnFunding}. ${Tooltips.CurrentImplFunding}`}
          />
        }
        value={`${formatNumber(currentImpliedFunding * 100)}%`}
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
              new Date().toLocaleString(undefined, {
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
        value={`11/18, 8:44 AM`}
      />
      <Metric
        flexBasis="250px"
        label={<Label label="Stack ETH if between" tooltipTitle={Tooltips.BullStrategyProfitThreshold} />}
        value={`~$1,128 - $1,293`}
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

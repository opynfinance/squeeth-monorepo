import React from 'react'
import { Typography, Box } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'

import Metric from '@components/Metric'
import { useAtom, useAtomValue } from 'jotai'
import { bullCRAtom } from '@state/bull/atoms'
import { crabStrategyCollatRatioAtomV2 } from '@state/crab/atoms'
import { currentImpliedFundingAtom, dailyHistoricalFundingAtom } from '@state/controller/atoms'
import { formatNumber } from '@utils/formatter'

const useStyles = makeStyles(() =>
  createStyles({
    metricLabel: {
      fontSize: '15px',
      fontWeight: 500,
      width: 'max-content',
      color: 'rgba(255, 255, 255, 0.5)',
    },
  }),
)

const BullStrategyMetrics: React.FC = () => {
  const classes = useStyles()
  const bullCr = useAtomValue(bullCRAtom).times(100)
  const crabCr = useAtomValue(crabStrategyCollatRatioAtomV2)
  const dailyHistoricalFunding = useAtomValue(dailyHistoricalFundingAtom)
  const currentImpliedFunding = useAtomValue(currentImpliedFundingAtom)

  return (
    <Box display="flex" alignItems="center" flexWrap="wrap" gridGap="12px">
      <Metric
        isSmall
        flexBasis="250px"
        label={<Typography className={classes.metricLabel}>ETH Price</Typography>}
        value={`$1,119.07`}
      />
      <Metric
        isSmall
        flexBasis="250px"
        label={<Typography className={classes.metricLabel}>Current Implied Premium</Typography>}
        value={`${formatNumber(currentImpliedFunding * 100)}%`}
      />
      <Metric
        isSmall
        flexBasis="250px"
        label={<Typography className={classes.metricLabel}>Historical Daily Premium</Typography>}
        value={`${formatNumber(dailyHistoricalFunding.funding * 100)}%`}
      />
      <Metric
        isSmall
        flexBasis="250px"
        label={<Typography className={classes.metricLabel}>Last rebalance</Typography>}
        value={`11/18, 8:44 AM`}
      />
      <Metric
        isSmall
        flexBasis="250px"
        label={<Typography className={classes.metricLabel}>Stacks ETH if between</Typography>}
        value={`~$1,128 - $1,293`}
      />
      <Metric
        isSmall
        flexBasis="250px"
        label={<Typography className={classes.metricLabel}>Collateralization Ratio</Typography>}
        value={`${(bullCr.lt(crabCr) ? bullCr : crabCr).toFixed(0)}%`}
      />
    </Box>
  )
}

export default BullStrategyMetrics

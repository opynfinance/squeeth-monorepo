import React from 'react'
import { Typography, Box } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'

import Metric from '@components/Metric'

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

  return (
    <Box display="flex" alignItems="center" flexWrap="wrap" gridGap="12px">
      <Metric
        isSmall
        flexBasis="180px"
        label={<Typography className={classes.metricLabel}>ETH Price</Typography>}
        value={`$1,119.07`}
      />
      <Metric
        isSmall
        flexBasis="180px"
        label={<Typography className={classes.metricLabel}>Current Implied Premium</Typography>}
        value={`0.22%`}
      />
      <Metric
        isSmall
        flexBasis="180px"
        label={<Typography className={classes.metricLabel}>Historical Daily Premium</Typography>}
        value={`0.21%`}
      />
      <Metric
        isSmall
        flexBasis="180px"
        label={<Typography className={classes.metricLabel}>Last rebalance</Typography>}
        value={`11/18, 8:44 AM`}
      />
      <Metric
        isSmall
        flexBasis="180px"
        label={<Typography className={classes.metricLabel}>Stacks ETH if between</Typography>}
        value={`~$1,128 - $1,293`}
      />
      <Metric
        isSmall
        flexBasis="180px"
        label={<Typography className={classes.metricLabel}>Collateralization Ratio</Typography>}
        value={`200%`}
      />
    </Box>
  )
}

export default BullStrategyMetrics

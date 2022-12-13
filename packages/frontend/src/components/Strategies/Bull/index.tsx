import React from 'react'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { Typography, Box } from '@material-ui/core'
import BigNumber from 'bignumber.js'

import BullCapDetails from './BullCapDetails'
import BullStrategyMetrics from './BullStrategyMetrics'
import BullTrade from './BullTrade'
import BullPosition from './BullPosition'
import BullStrategyInfo from './BullStrategyInfo'
import BullStrategyRebalances from './BullStrategyRebalances'
import BullStrategyCharts from './BullStrategyCharts'
import { useInitBullStrategy } from '@state/bull/hooks'

const useStyles = makeStyles((theme) =>
  createStyles({
    columnContainer: {
      marginTop: '32px',
      display: 'flex',
      justifyContent: 'center',
      gridGap: '96px',
      flexWrap: 'wrap',
      [theme.breakpoints.down('md')]: {
        gridGap: '40px',
      },
    },
    leftColumn: {
      flex: 1,
      minWidth: '480px',
      [theme.breakpoints.down('xs')]: {
        minWidth: '320px',
      },
    },
    rightColumn: {
      flexBasis: '440px',
      [theme.breakpoints.down('xs')]: {
        flex: '1',
      },
    },
    subtitle: {
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    tradeSection: {
      border: '1px solid #242728',
      boxShadow: '0px 4px 40px rgba(0, 0, 0, 0.25)',
      borderRadius: theme.spacing(0.7),
      padding: '32px 24px',
    },
  }),
)

function BullStrategy() {
  const classes = useStyles()
  useInitBullStrategy()

  return (
    <div>
      <Box marginTop="40px">
        <BullPosition />
      </Box>
      <div className={classes.columnContainer}>
        <div className={classes.leftColumn}>
          <Box>
            <Typography variant="h4" className={classes.subtitle}>
              Strategy Details
            </Typography>
            <Box marginTop="12px">
              <BullCapDetails />
            </Box>
            <Box marginTop="32px">
              <BullStrategyMetrics />
            </Box>

            <Box marginTop="32px">
              <BullStrategyCharts />
            </Box>

            <Box marginTop="32px">
              <BullStrategyInfo />
            </Box>

            <Box marginTop="32px">
              <BullStrategyRebalances />
            </Box>
          </Box>
        </div>
        <div className={classes.rightColumn}>
          <div className={classes.tradeSection}>
            <BullTrade maxCap={new BigNumber(7000)} depositedAmount={new BigNumber(200)} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default BullStrategy

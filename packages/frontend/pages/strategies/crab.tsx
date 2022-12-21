import BigNumber from 'bignumber.js'
import React, { useEffect, useState } from 'react'
import { Typography, Box } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { useAtomValue } from 'jotai'

import CapDetails from '@components/Strategies/Crab/CapDetails'
import CapDetailsV2 from '@components/Strategies/Crab/CapDetailsV2'
import CrabStrategyV2History from '@components/Strategies/Crab/StrategyHistoryV2'
import StrategyInfo from '@components/Strategies/Crab/StrategyInfoV2'
import CrabTrade from '@components/Strategies/Crab/CrabTrade'
import CrabTradeV2 from '@components/Strategies/Crab/CrabTradeV2'
import { StrategyChartsV2 } from '@components/Strategies/Crab/StrategyChartsV2'
import CrabPositionV2 from '@components/Strategies/Crab/CrabPositionV2'
import CrabMetricsV2 from '@components/Strategies/Crab/CrabMetricsV2'
import {
  crabStrategyCollatRatioAtom,
  crabStrategyCollatRatioAtomV2,
  crabStrategyVaultAtom,
  crabStrategyVaultAtomV2,
  maxCapAtom,
  maxCapAtomV2,
} from '@state/crab/atoms'
import {
  useCurrentCrabPositionValueV2,
  useSetStrategyData,
  useSetStrategyDataV2,
  useCurrentCrabPositionValue,
} from '@state/crab/hooks'
import { useInitCrabMigration } from '@state/crabMigration/hooks'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      maxWidth: '1280px',
      width: '80%',
      margin: '0 auto',
      padding: theme.spacing(1, 5),
      [theme.breakpoints.down('lg')]: {
        maxWidth: 'none',
        width: '90%',
      },
      [theme.breakpoints.down('md')]: {
        width: '100%',
      },
      [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(1, 4),
      },
      [theme.breakpoints.down('xs')]: {
        padding: theme.spacing(1, 3),
      },
    },
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
      flexBasis: '452px',
      [theme.breakpoints.down('xs')]: {
        flex: '1',
      },
    },
    subtitle: {
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    comingSoon: {
      height: '50vh',
      display: 'flex',
      alignItems: 'center',
      marginTop: theme.spacing(4),
    },
    tradeSection: {
      border: '1px solid #242728',
      boxShadow: '0px 4px 40px rgba(0, 0, 0, 0.25)',
      borderRadius: theme.spacing(0.7),
      padding: '32px 24px',
    },
  }),
)

const Strategies: React.FC = () => {
  // which crab strategy to display. V1 or V2.
  const [displayCrabV1] = useState(false)

  const classes = useStyles()
  const maxCap = useAtomValue(displayCrabV1 ? maxCapAtom : maxCapAtomV2)
  const vault = useAtomValue(displayCrabV1 ? crabStrategyVaultAtom : crabStrategyVaultAtomV2)
  const collatRatio = useAtomValue(displayCrabV1 ? crabStrategyCollatRatioAtom : crabStrategyCollatRatioAtomV2)
  const setStrategyData = useSetStrategyData()
  const setStrategyDataV2 = useSetStrategyDataV2()

  useCurrentCrabPositionValueV2()
  useCurrentCrabPositionValue()
  useInitCrabMigration()

  const CapDetailsComponent = displayCrabV1 ? CapDetails : CapDetailsV2
  const CrabTradeComponent = displayCrabV1 ? CrabTrade : CrabTradeV2

  useEffect(() => {
    if (displayCrabV1) setStrategyData()
  }, [collatRatio, displayCrabV1, setStrategyData])

  useEffect(() => {
    if (!displayCrabV1) setStrategyDataV2()
  }, [collatRatio, displayCrabV1, setStrategyDataV2])

  return (
    <div>
      <Box marginTop="40px">
        <CrabPositionV2 />
      </Box>

      <div className={classes.columnContainer}>
        <div className={classes.leftColumn}>
          <Box>
            <Typography variant="h4" className={classes.subtitle}>
              Strategy Details
            </Typography>

            <Box marginTop="12px">
              <CapDetailsComponent maxCap={maxCap} depositedAmount={vault?.collateralAmount || new BigNumber(0)} />
            </Box>
          </Box>

          <CrabMetricsV2 />

          <Box marginTop="32px">
            <Typography variant="h4" className={classes.subtitle}>
              Performance
            </Typography>

            <Box marginTop="12px">
              <StrategyChartsV2 />
            </Box>
          </Box>

          <Box marginTop="32px">
            <Typography variant="h4" className={classes.subtitle}>
              Profitability conditions
            </Typography>
            <StrategyInfo />
          </Box>

          <Box marginTop="32px">
            <Typography variant="h4" className={classes.subtitle}>
              Strategy Hedges
            </Typography>
            <Box marginTop="24px">
              <CrabStrategyV2History />
            </Box>
          </Box>
        </div>
        <div className={classes.rightColumn}>
          <div className={classes.tradeSection}>
            <CrabTradeComponent maxCap={maxCap} depositedAmount={vault?.collateralAmount || new BigNumber(0)} />
          </div>
        </div>
      </div>
    </div>
  )
}

const Page: React.FC = () => <Strategies />

export default Page

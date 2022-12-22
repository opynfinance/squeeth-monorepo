import BigNumber from 'bignumber.js'
import React from 'react'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { useAtomValue } from 'jotai'

import CrabTradeV2 from '@components/Strategies/Crab/CrabTradeV2'
import MyPosition from '@components/Strategies/Crab/MyPosition'
import About from '@components/Strategies/Crab/About'
import StrategyPerformance from '@components/Strategies/Crab/StrategyPerformance'
import { crabStrategyVaultAtomV2, maxCapAtomV2 } from '@state/crab/atoms'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
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
    infoContainer: {
      display: 'flex',
      flexDirection: 'column',
      gap: '72px',
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
  const maxCap = useAtomValue(maxCapAtomV2)
  const vault = useAtomValue(crabStrategyVaultAtomV2)

  const classes = useStyles()

  return (
    <div className={classes.container}>
      <div className={classes.leftColumn}>
        <div className={classes.infoContainer}>
          <MyPosition />
          <StrategyPerformance />
          <About />
        </div>
      </div>
      <div className={classes.rightColumn}>
        <div className={classes.tradeSection}>
          <CrabTradeV2 maxCap={maxCap} depositedAmount={vault?.collateralAmount || new BigNumber(0)} />
        </div>
      </div>
    </div>
  )
}

const Page: React.FC = () => <Strategies />

export default Page

import BigNumber from 'bignumber.js'
import React from 'react'
import { Typography, Box } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { useAtomValue } from 'jotai'

import CrabTradeV2 from '@components/Strategies/Crab/CrabTradeV2'
import NextHedgeTimer from '@components/Strategies/Crab/NextHedgeTimer'
import CrabProfitabilityChart from '@components/Strategies/Crab/CrabProfitabilityChart'
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
    sectionTitle: {
      fontSize: '22px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    text: {
      marginTop: '16px',
      color: '#BDBDBD',
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
        <div>
          <Typography variant="h2" className={classes.sectionTitle}>
            About Crab
          </Typography>
          <Typography variant="body1" className={classes.text}>
            In general, Crab earns USDC returns except when there is high ETH volatility in the market, when it may draw
            down. The strategy stacks USDC if ETH is within the below bands at the next hedge.
          </Typography>

          <Box position="relative" marginTop="32px">
            <Box position="absolute" top="10px" right="0px">
              <NextHedgeTimer />
            </Box>
            <CrabProfitabilityChart />
          </Box>
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

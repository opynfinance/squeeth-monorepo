import { useState } from 'react'
import { Grid, Typography, Box } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import { useAtomValue, useAtom } from 'jotai'
import { useResetAtom } from 'jotai/utils'

import Nav from '@components/Nav'
import { WelcomeModal } from '@components/Trade/WelcomeModal'
import { ethTradeAmountAtom, sqthTradeAmountAtom, tradeTypeAtom } from '@state/trade/atoms'
import { isTransactionFirstStepAtom, transactionDataAtom, transactionLoadingAtom } from '@state/wallet/atoms'
import { LongChartPayoff } from '@components/Charts/LongChartPayoff'
import ShortFundingChart from '@components/Charts/ShortFundingChart'
import SqueethMetrics from '@components/TradeNew/SqueethMetrics'
import { SqueethTabNew, SqueethTabsNew } from '@components/Tabs'
import Trade from '@components/TradeNew'
import { TradeType } from '../src/types'

const Header: React.FC = () => {
  const classes = useStyles()
  const tradeType = useAtomValue(tradeTypeAtom)

  if (tradeType === TradeType.LONG) {
    return (
      <>
        <Typography variant="h3" className={classes.title}>
          Long Squeeth - ETH&sup2; Position
        </Typography>
        <Typography variant="subtitle1" className={classes.description}>
          Perpetual leverage without liquidations
        </Typography>
      </>
    )
  } else {
    return (
      <>
        <Typography variant="h3" className={classes.title}>
          Covered Short Squeeth - Short ETH&sup2; Position
        </Typography>
        <Typography variant="subtitle1" className={classes.description}>
          Earn premiums for selling ETH collateralized squeeth
        </Typography>
      </>
    )
  }
}

const TabComponent: React.FC = () => {
  const [tradeType, setTradeType] = useAtom(tradeTypeAtom)
  const resetEthTradeAmount = useResetAtom(ethTradeAmountAtom)
  const resetSqthTradeAmount = useResetAtom(sqthTradeAmountAtom)
  const resetTransactionData = useResetAtom(transactionDataAtom)
  const transactionInProgress = useAtomValue(transactionLoadingAtom)
  const isTxFirstStep = useAtomValue(isTransactionFirstStepAtom)

  return (
    <div>
      <SqueethTabsNew
        value={tradeType}
        onChange={(evt, val) => {
          setTradeType(val)

          if (!transactionInProgress || !isTxFirstStep) {
            resetEthTradeAmount()
            resetSqthTradeAmount()
            resetTransactionData()
          }
        }}
        aria-label="Sub nav tabs"
        centered
      >
        <SqueethTabNew fullWidth label="Long" id="long-card-btn" />
        <SqueethTabNew fullWidth label="Short" id="short-card-btn" />
      </SqueethTabsNew>
    </div>
  )
}

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(6, 10),
      maxWidth: '1600px',
      width: '95%',
      marginLeft: 'auto',
      marginRight: 'auto',
      gap: '72px',
      justifyContent: 'space-between',
    },
    leftColumn: {
      maxWidth: '800px',
      width: '100%',
    },
    rightColumn: {
      width: '420px',
    },
    title: {
      fontSize: '28px',
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    subtitle: {
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    description: {
      fontSize: '18px',
      fontWeight: 400,
      color: theme.palette.grey[400],
    },
  }),
)

function TradePage() {
  const classes = useStyles()
  const [isWelcomeModalOpen, setWelcomeModalOpen] = useState(false)
  const tradeType = useAtomValue(tradeTypeAtom)

  const handleClose = () => setWelcomeModalOpen(false)

  return (
    <>
      <div>
        <Nav />

        <Grid container className={classes.container}>
          <Grid item className={classes.leftColumn}>
            <Header />

            <Box marginTop="32px">{tradeType === TradeType.LONG ? <LongChartPayoff /> : <ShortFundingChart />}</Box>

            <Box marginTop="76px">
              <Typography variant="h4" className={classes.subtitle}>
                Details
              </Typography>
              <SqueethMetrics marginTop="24px" />
            </Box>
          </Grid>

          <Grid item className={classes.rightColumn}>
            <TabComponent />

            <Box marginTop="32px">
              <Typography variant="h4" className={classes.subtitle}>
                Position
              </Typography>

              <Trade marginTop="16px" />
            </Box>
          </Grid>
        </Grid>
      </div>

      <WelcomeModal open={isWelcomeModalOpen} handleClose={handleClose} />
    </>
  )
}

export default TradePage

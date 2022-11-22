import { useState } from 'react'
import { Grid, Typography, Box } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import { useAtomValue } from 'jotai'

import Nav from '@components/Nav'
import { WelcomeModal } from '@components/Trade/WelcomeModal'
import { tradeTypeAtom } from '@state/trade/atoms'
import { LongChartPayoff } from '@components/Charts/LongChartPayoff'
import ShortFundingChart from '@components/Charts/ShortFundingChart'
import Metrics from '@components/Trade/Metrics'
import { TradeType } from '../src/types'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(9, 10),
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
      minWidth: '400px',
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
  const [isWelcomeModalOpen, setWelcomeModalOpen] = useState(false)

  const tradeType = useAtomValue(tradeTypeAtom)

  const handleClose = () => setWelcomeModalOpen(false)

  const classes = useStyles()

  return (
    <>
      <div>
        <Nav />

        <Grid container className={classes.container}>
          <Grid item className={classes.leftColumn}>
            <Typography variant="h3" className={classes.title}>
              Long Squeeth - ETH&sup2; Position
            </Typography>
            <Typography variant="subtitle1" className={classes.description}>
              Perpetual leverage without liquidations
            </Typography>

            <Box marginTop="12px">{tradeType === TradeType.LONG ? <LongChartPayoff /> : <ShortFundingChart />}</Box>

            <Box marginTop="84px">
              <Typography variant="h4" className={classes.subtitle}>
                Details
              </Typography>
              <Metrics marginTop="24px" />
            </Box>
          </Grid>

          <Grid item className={classes.rightColumn}>
            <Typography variant="h4" className={classes.subtitle}>
              Position
            </Typography>
          </Grid>
        </Grid>
      </div>

      <WelcomeModal open={isWelcomeModalOpen} handleClose={handleClose} />
    </>
  )
}

export default TradePage

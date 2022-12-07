import { createStyles, makeStyles } from '@material-ui/core'
import { Box, Typography } from '@material-ui/core'
import React, { useState } from 'react'

import ObtainSqueeth from '@components/Lp/ObtainSqueeth'
import SqueethInfo from '@components/Lp/SqueethInfo'
import LPPosition from '@components/Lp/LPPosition'
import LPBuyChart from '@components/Charts/LPBuyChart'
import LPMintChart from '@components/Charts/LPMintChart'
import Nav from '@components/Nav'
import { LPProvider } from '@context/lp'
import { SqueethTabNew, SqueethTabsNew } from '@components/Tabs'
import { useETHPrice } from '@hooks/useETHPrice'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      maxWidth: '1280px',
      width: '80%',
      display: 'flex',
      justifyContent: 'center',
      gridGap: '96px',
      flexWrap: 'wrap',
      padding: theme.spacing(6, 5),
      margin: '0 auto',
      [theme.breakpoints.down('lg')]: {
        maxWidth: 'none',
        width: '90%',
      },
      [theme.breakpoints.down('md')]: {
        width: '100%',
        gridGap: '40px',
      },
      [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(3, 4),
      },
      [theme.breakpoints.down('xs')]: {
        padding: theme.spacing(3, 3),
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
    title: {
      fontSize: '28px',
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    description: {
      fontSize: '18px',
      fontWeight: 400,
      color: theme.palette.grey[400],
    },
    subtitle: {
      fontSize: '22px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    sectionTitle: {
      marginTop: theme.spacing(3),
      color: 'rgb(255, 255, 255)',
      fontWeight: 500,
      fontSize: '18px',
      letterSpacing: '-0.01em',
    },

    details: {
      marginTop: theme.spacing(4),
    },
    tradeForm: {
      position: 'sticky',
      top: '100px',
      border: '1px solid #242728',
      boxShadow: '0px 4px 40px rgba(0, 0, 0, 0.25)',
      borderRadius: theme.spacing(0.7),
      padding: '32px 24px 24px 24px',
    },
    chartNav: {
      border: `1px solid ${theme.palette.primary.main}30`,
    },
    content: {
      color: '#bdbdbd',
      marginTop: '4px',
    },
  }),
)

const LPInfo: React.FC<{ lpType: number }> = ({ lpType }) => {
  const classes = useStyles()
  const ethPrice = useETHPrice()

  if (lpType === 0) {
    return (
      <>
        <Typography variant="h4" className={classes.subtitle}>
          Buy squeeth and LP
        </Typography>
        <Typography variant="body1" className={classes.content}>
          Earn a payoff similar to ETH<sup>1.5</sup>
        </Typography>
        <Typography variant="subtitle1" className={classes.sectionTitle}>
          Details
        </Typography>
        <Typography variant="body1" className={classes.content}>
          Buying and LPing gives you a leverage position with a payoff similar to ETH<sup>1.5</sup>. You give up some of
          your squeeth upside in exchange for trading fees. You are paying daily premiums for being long squeeth, but
          earning fees from LPing on Uniswap.
        </Typography>
        <Typography variant="subtitle1" className={classes.sectionTitle}>
          Payoff
        </Typography>
        <LPBuyChart ethPrice={ethPrice.toNumber()} />
        <Typography variant="caption" color="textSecondary">
          This payoff diagram does not include premiums or trading fees and assumes implied volatility stays constant.{' '}
        </Typography>
        <Typography variant="subtitle1" className={classes.sectionTitle}>
          Risks
        </Typography>
        <Typography variant="body1" className={classes.content}>
          You are exposed to squeeth premiums, so if you hold the position for a long period of time without upward
          price movements in ETH, you can lose considerable funds to premium payments.
        </Typography>
        <br />
        <Typography variant="body1" className={classes.content}>
          {' '}
          Squeeth smart contracts have been audited by Trail of Bits, Akira, and Sherlock. However, smart contracts are
          experimental technology and we encourage caution only risking funds you can afford to lose.
        </Typography>
      </>
    )
  }

  return (
    <>
      <Typography variant="h4" className={classes.subtitle}>
        Mint squeeth and LP
      </Typography>
      <Typography variant="body1" className={classes.content}>
        Earn yield from trading fees while being long ETH
      </Typography>
      <Typography variant="subtitle1" className={classes.sectionTitle}>
        Details
      </Typography>
      <Typography variant="body1" className={classes.content}>
        Minting and LPing is similar to a covered call. You start off with a position similar to 1x long ETH that gets
        less long ETH as the price moves up and longer ETH as the price moves down.
      </Typography>
      <Typography variant="subtitle1" className={classes.sectionTitle}>
        Payoff
      </Typography>
      <LPMintChart ethPrice={ethPrice.toNumber()} />
      <Typography variant="caption" color="textSecondary">
        This payoff diagram does not included premiums or trading fees and assumes implied volatility stays constant.{' '}
      </Typography>
      <Typography variant="subtitle1" className={classes.sectionTitle}>
        Risks
      </Typography>
      <Typography variant="body1" className={classes.content}>
        You enter this position neutral to squeeth exposure, but could end up long squeeth exposed to premiums or short
        squeeth depending on ETH price movements. If you fall below the minimum collateralization threshold (150%), you
        are at risk of liquidation.
      </Typography>
      <br />
      <Typography variant="body1" className={classes.content}>
        Squeeth smart contracts have been audited by Trail of Bits, Akira, and Sherlock. However, smart contracts are
        experimental technology and we encourage caution only risking funds you can afford to lose.
      </Typography>
    </>
  )
}

export function LPCalculator() {
  const classes = useStyles()
  const [lpType, setLpType] = useState(0)

  return (
    <>
      <Nav />

      <div className={classes.container}>
        <div className={classes.leftColumn}>
          <>
            <Typography variant="h3" className={classes.title}>
              Uniswap V3 LP SQTH-ETH Pool
            </Typography>
            <Typography variant="subtitle1" className={classes.description}>
              Earn LP fees for providing SQTH-ETH liquidity
            </Typography>
          </>

          <Box marginTop="24px">
            <LPPosition />
          </Box>

          <div className={classes.details}>
            <Box display="flex">
              <SqueethTabsNew
                style={{ background: 'transparent' }}
                className={classes.chartNav}
                value={lpType}
                onChange={(evt, val) => setLpType(val)}
                aria-label="Sub nav tabs"
                scrollButtons="auto"
                variant="scrollable"
              >
                <SqueethTabNew label="Buy and LP" style={{ width: '140px' }} />
                <SqueethTabNew label="Mint and LP" style={{ width: '140px' }} />
              </SqueethTabsNew>
            </Box>

            <Box marginTop="24px">
              <LPInfo lpType={lpType} />
            </Box>
          </div>

          <Box marginTop="32px">
            <Typography variant="h4" className={classes.subtitle}>
              Metrics
            </Typography>
            <SqueethInfo marginTop="16px" />
          </Box>
        </div>

        <div className={classes.rightColumn}>
          <div className={classes.tradeForm}>
            <ObtainSqueeth />
          </div>
        </div>
      </div>
    </>
  )
}

export function LPage() {
  return (
    <LPProvider>
      <LPCalculator />
    </LPProvider>
  )
}

export default LPage

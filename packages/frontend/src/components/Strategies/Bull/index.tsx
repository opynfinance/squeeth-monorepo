import React, { useEffect } from 'react'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { Link, Typography } from '@material-ui/core'

import { useInitBullRecoveryStrategy } from '@state/bull/hooks'
import { useSetStrategyDataV2, useCurrentCrabPositionValueV2 } from '@state/crab/hooks'
import { useDisconnectWallet } from '@state/wallet/hooks'
import About from './About'
import StrategyPerformance from './StrategyPerformance'
import BullTrade from './BullTrade'
import Alert from '@components/Alert'

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
      borderRadius: theme.spacing(1),
      padding: '32px 24px',
    },
    topAlert: {
      marginTop: '16px',
    },
  }),
)

const Bull: React.FC = () => {
  const setStrategyDataV2 = useSetStrategyDataV2()
  const disconnectWallet = useDisconnectWallet()
  const classes = useStyles()

  useCurrentCrabPositionValueV2()
  useInitBullRecoveryStrategy()

  useEffect(() => {
    setStrategyDataV2()
  }, [setStrategyDataV2])

  useEffect(() => {
    // make sure user has specifically connected the wallet to zenbull before
    const hasConnectedToZenbullBefore = window.localStorage.getItem('walletConnectedToZenbull') === 'true'
    if (!hasConnectedToZenbullBefore) {
      disconnectWallet()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <div className={classes.topAlert}>
        <Alert severity="warning">
          <Typography style={{ fontSize: '15px', fontWeight: 500 }}>
            Zen Bull has been impacted by the Euler Finance exploit. All other Squeeth contracts are unaffected. Please{' '}
            <Link
              style={{ fontSize: '15px', fontWeight: 500 }}
              target="_blank"
              href="https://discord.com/invite/2NFdXaE"
            >
              join discord
            </Link>{' '}
            for updates. You can recover funds from Recovery withdrawal section below.
          </Typography>
        </Alert>
      </div>
      <div className={classes.container}>
        <div className={classes.leftColumn}>
          <div className={classes.infoContainer}>
            {/* <MyPosition /> */}
            {/* <StrategyPerformance /> */}
            <About />
          </div>
        </div>
        <div className={classes.rightColumn}>
          <div className={classes.tradeSection}>
            <BullTrade />
          </div>
        </div>
      </div>
    </>
  )
}

export default Bull

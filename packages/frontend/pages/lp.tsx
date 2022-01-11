import { createStyles, makeStyles } from '@material-ui/core'
import Typography from '@material-ui/core/Typography'
import Image from 'next/image'
import React from 'react'

import squeethTokenSymbol from '../public/images/Squeeth.svg'
import { LPTable } from '@components/Lp/LPTable'
import ObtainSqueeth from '@components/Lp/ObtainSqueeth'
import SqueethInfo from '@components/Lp/SqueethInfo'
import Nav from '@components/Nav'
import { LPProvider } from '@context/lp'
import { TradeProvider } from '@context/trade'
import { useSqueethPool } from '@hooks/contracts/useSqueethPool'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      height: 'calc(100vh - 64px)',
      maxHeight: '1000px',
      padding: theme.spacing(4),
      maxWidth: '1600px',
    },
    logoContainer: {
      display: 'flex',
      alignItems: 'center',
      width: '100%',
    },
    logoTitle: {
      marginLeft: theme.spacing(1),
      [theme.breakpoints.down('sm')]: {
        fontSize: 18,
      },
    },
    logoSubTitle: {
      marginLeft: theme.spacing(1),
      [theme.breakpoints.down('sm')]: {
        fontSize: 16,
      },
    },
    logo: {
      marginTop: theme.spacing(0.5),
      alignSelf: 'flex-start',
    },
  }),
)

export function LPCalculator() {
  const classes = useStyles()
  const { pool } = useSqueethPool()

  return (
    <div>
      <Nav />
      <div className={classes.container}>
        <div className={classes.logoContainer}>
          <div className={classes.logo}>
            <Image src={squeethTokenSymbol} alt="squeeth token" width={37} height={37} />
          </div>
          <div>
            <Typography variant="h5" className={classes.logoTitle}>
              Uniswap V3 LP SQTH-ETH Pool
            </Typography>
            <Typography className={classes.logoSubTitle} variant="body1" color="textSecondary">
              Earn LP fees for providing SQTH-ETH liquidity
            </Typography>
          </div>
          <SqueethInfo />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            height: '78vh',
          }}
        >
          <LPTable isLPage={true} pool={pool}></LPTable>
          <ObtainSqueeth />
        </div>
      </div>
    </div>
  )
}

export function LPage() {
  return (
    <TradeProvider>
      <LPProvider>
        <LPCalculator />
      </LPProvider>
    </TradeProvider>
  )
}

export default LPage

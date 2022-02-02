import { createStyles, makeStyles } from '@material-ui/core'
import Typography from '@material-ui/core/Typography'
import Image from 'next/image'
import React from 'react'

import squeethTokenSymbol from '../public/images/Squeeth.svg'
import { LPTable } from '@components/Lp/LPTable'
import ObtainSqueeth from '@components/Lp/ObtainSqueeth'
import SqueethInfo from '@components/Lp/SqueethInfo'
import LPBuyChart from '@components/Charts/LPBuyChart'
import LPMintChart from '@components/Charts/LPMintChart'
import Nav from '@components/Nav'
import RestrictionInfo from '@components/RestrictionInfo'
import { LPProvider } from '@context/lp'
import { useRestrictUser } from '@context/restrict-user'
import { TradeProvider } from '@context/trade'
import { useSqueethPool } from '@hooks/contracts/useSqueethPool'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(4, 10),
      marginLeft: 'auto',
      marginRight: 'auto',
      maxWidth: '1500px',
      display: 'flex',
      justifyContent: 'space-between',
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
    comparison: {
      marginTop: theme.spacing(4),
      //paddingBottom: theme.spacing(2),
    },
    comparisonItem: {
      width: '400px',
    },
    comparisonPoint: {
      marginTop: theme.spacing(2),
      padding: theme.spacing(0, 2),
    },
  }),
)

export function LPCalculator() {
  const classes = useStyles()
  const { isRestricted } = useRestrictUser()
  const { pool } = useSqueethPool()

  return (
    <div>
      <Nav />
      <div className={classes.container}>
        <div style={{ width: '800px' }}>
          <div style={{ display: 'flex' }}>
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
          </div>
          <SqueethInfo />
          <div className={classes.comparison}>
            <table>
              <tr>
                <th className={classes.comparisonItem}>
                  <Typography align="center" color="primary">
                    Buy squeeth and LP
                  </Typography>
                </th>
                <th className={classes.comparisonItem}>
                  <Typography align="center" color="primary">
                    Mint squeeth and LP
                  </Typography>
                </th>
              </tr>
              <tr>
                <td>
                  <Typography className={classes.comparisonPoint}>This position earns ETH^1.5 USD payoff</Typography>
                </td>
                <td>
                  <Typography className={classes.comparisonPoint}>
                    Initially similar to 1x long ETH but gets less long ETH as the price moves up and gets longer ETH as
                    the price moves down
                  </Typography>
                </td>
              </tr>
              <tr>
                <td>
                  <Typography className={classes.comparisonPoint}>
                    Give up some upside of your squeeth exposure in exchange for trading fees
                  </Typography>
                </td>
                <td>
                  <Typography className={classes.comparisonPoint}>
                    Earn yield from trading fees while being long ETH
                  </Typography>
                </td>
              </tr>
              <tr>
                <td>
                  <LPBuyChart ethPrice={3000} />
                </td>
                <td>
                  <LPMintChart ethPrice={3000} />
                </td>
              </tr>
            </table>
            {/* <div className={classes.comparisonItem}></div>
            <div className={classes.comparisonItem}></div> */}
          </div>
          {/* <LPTable isLPage={true} pool={pool}></LPTable> */}
        </div>
        <div>{!isRestricted ? <ObtainSqueeth /> : null}</div>
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

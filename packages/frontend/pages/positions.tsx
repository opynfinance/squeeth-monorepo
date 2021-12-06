import { createStyles, makeStyles, Typography } from '@material-ui/core'
import Link from 'next/link'

import { LPTable } from '../src/components/Lp/LPTable'
import Nav from '../src/components/Nav'
import History from '../src/components/Trade/History'
import { useSqueethPool } from '../src/hooks/contracts/useSqueethPool'
import { useETHPrice } from '../src/hooks/useETHPrice'
import { useLongPositions, useLPPositions, usePnL, useShortPositions } from '../src/hooks/usePositions'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      margin: theme.spacing(6, 8),
      width: '800px',
      marginLeft: 'auto',
      marginRight: 'auto',
      [theme.breakpoints.down('sm')]: {
        width: '100%',
        padding: theme.spacing(0, 2),
      },
    },
    header: {
      marginTop: theme.spacing(8),
      display: 'flex',
      justifyContent: 'space-between',
    },
    position: {
      padding: theme.spacing(2),
      backgroundColor: `${theme.palette.background.paper}40`,
      marginTop: theme.spacing(2),
      borderRadius: theme.spacing(1),
      display: 'flex',
      justifyContent: 'space-between',
      [theme.breakpoints.down('sm')]: {
        display: 'block',
      },
    },
    positionData: {
      display: 'flex',
      justifyContent: 'space-between',
      width: '65%',
      [theme.breakpoints.down('sm')]: {
        marginTop: theme.spacing(1),
        width: '100%',
      },
    },
    shortPositionData: {
      width: '65%',
      [theme.breakpoints.down('sm')]: {
        marginTop: theme.spacing(1),
        width: '100%',
      },
    },
    innerPositionData: {
      display: 'flex',
      width: '100%',
    },
    positionTitle: {
      width: '30%',
      [theme.breakpoints.down('sm')]: {
        width: '100%',
      },
    },
    empty: {
      marginTop: theme.spacing(2),
    },
    green: {
      color: theme.palette.success.main,
    },
    red: {
      color: theme.palette.error.main,
    },
    history: {
      marginTop: theme.spacing(8),
    },
    link: {
      color: theme.palette.primary.main,
      textDecoration: 'underline',
      fontWeight: 600,
      fontSize: 14,
      marginTop: theme.spacing(1),
    },
  }),
)

export default function Positions() {
  const classes = useStyles()
  const { loading: isLongLoading, wethAmount: longWethAmt, squeethAmount: wSqueethBal } = useLongPositions()
  const {
    loading: isShortLoading,
    wethAmount: shortWethAmt,
    shortVaults,
    existingCollat,
    existingCollatPercent,
    liquidationPrice,
    vaultId,
    firstValidVault,
  } = useShortPositions()
  const {
    longGain,
    shortGain,
    buyQuote,
    sellQuote,
    longUsdAmt,
    shortUsdAmt,
    longRealizedPNL,
    shortRealizedPNL,
    loading: isPnLLoading,
  } = usePnL()
  const ethPrice = useETHPrice()
  const { activePositions } = useLPPositions()
  const { pool } = useSqueethPool()

  return (
    <div>
      <Nav />
      <div className={classes.container}>
        <div className={classes.header}>
          <Typography color="primary" variant="h6">
            Your Positions
          </Typography>
          <div>
            <Typography component="span" color="textSecondary">
              ETH Price:{' '}
            </Typography>
            <Typography component="span">$ {ethPrice.toFixed(2)}</Typography>
          </div>
        </div>
        {wSqueethBal.isZero() && shortVaults.length && shortVaults[firstValidVault].shortAmount.isZero() && (
          <div className={classes.empty}>
            <Typography>No active positions</Typography>
          </div>
        )}
        {wSqueethBal.isGreaterThan(0) && (
          <div className={classes.position}>
            <div className={classes.positionTitle}>
              <Typography>Long Squeeth</Typography>
            </div>
            <div className={classes.shortPositionData}>
              <div className={classes.innerPositionData}>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Position
                  </Typography>
                  <Typography variant="body1">
                    {isLongLoading && wSqueethBal.toNumber() === 0 ? 'Loading' : wSqueethBal.toFixed(8)}&nbsp; oSQTH
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    $
                    {isPnLLoading && sellQuote.amountOut.times(ethPrice).toNumber() === 0
                      ? 'Loading'
                      : sellQuote.amountOut.times(ethPrice).toFixed(2)}
                  </Typography>
                </div>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" color="textSecondary">
                    Unrealized P&L
                  </Typography>
                  {isPnLLoading ? (
                    <Typography variant="body1">Loading</Typography>
                  ) : (
                    <>
                      <Typography variant="body1" className={longGain < 0 ? classes.red : classes.green}>
                        ${sellQuote.amountOut.times(ethPrice).minus(longUsdAmt.abs()).toFixed(2)}
                      </Typography>
                      <Typography variant="caption" className={longGain < 0 ? classes.red : classes.green}>
                        {(longGain || 0).toFixed(2)}%
                      </Typography>
                    </>
                  )}
                </div>
              </div>
              <div className={classes.innerPositionData} style={{ marginTop: '16px' }}>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Realized P&L
                  </Typography>
                  <Typography variant="body1" className={longRealizedPNL.gte(0) ? classes.green : classes.red}>
                    ${isPnLLoading && longRealizedPNL.toNumber() === 0 ? 'Loading' : longRealizedPNL.toFixed(2)}
                  </Typography>
                </div>
              </div>
            </div>
          </div>
        )}
        {shortVaults.length && shortVaults[firstValidVault].shortAmount.isGreaterThan(0) && (
          <div className={classes.position}>
            <div className={classes.positionTitle}>
              <Typography>Short Squeeth</Typography>
              <Typography className={classes.link}>
                <Link href={`vault/${vaultId}`}>Manage</Link>
              </Typography>
            </div>
            <div className={classes.shortPositionData}>
              <div className={classes.innerPositionData}>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Position
                  </Typography>
                  <Typography variant="body1">
                    {shortVaults.length && shortVaults[firstValidVault].shortAmount.toFixed(6)}&nbsp; oSQTH
                  </Typography>
                  <Typography variant="body2" color="textSecondary">
                    ${buyQuote.times(ethPrice).toFixed(2)}
                  </Typography>
                </div>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" color="textSecondary">
                    Unrealized P&L
                  </Typography>
                  {isPnLLoading ? (
                    <Typography variant="body1">Loading</Typography>
                  ) : (
                    <>
                      <Typography variant="body1" className={shortGain < 0 ? classes.red : classes.green}>
                        ${buyQuote.times(ethPrice).minus(shortUsdAmt.abs()).toFixed(2)}
                      </Typography>
                      <Typography variant="caption" className={shortGain < 0 ? classes.red : classes.green}>
                        {(shortGain || 0).toFixed(2)}%
                      </Typography>
                    </>
                  )}
                </div>
              </div>
              <div className={classes.innerPositionData} style={{ marginTop: '16px' }}>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Liquidation Price
                  </Typography>
                  <Typography variant="body1">
                    ${isShortLoading && liquidationPrice === 0 ? 'Loading' : liquidationPrice.toFixed(2)}
                  </Typography>
                </div>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Collateral (Amt / Ratio)
                  </Typography>
                  <Typography variant="body1">
                    {isShortLoading && existingCollat.toNumber() === 0 ? 'Loading' : existingCollat.toFixed(4)} ETH (
                    {existingCollatPercent}%)
                  </Typography>
                </div>
              </div>
              <div className={classes.innerPositionData} style={{ marginTop: '16px' }}>
                <div style={{ width: '50%' }}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Realized P&L
                  </Typography>
                  <Typography variant="body1" className={shortRealizedPNL.gte(0) ? classes.green : classes.red}>
                    ${isPnLLoading && shortRealizedPNL.toNumber() === 0 ? 'Loading' : shortRealizedPNL.toFixed(2)}
                  </Typography>
                </div>
              </div>
            </div>
          </div>
        )}
        {activePositions?.length > 0 && (
          <>
            <div className={classes.header}>
              <Typography color="primary" variant="h6">
                Your LP Positions
              </Typography>
            </div>
            <LPTable isLPage={false} pool={pool} />
          </>
        )}
        <div className={classes.history}>
          <Typography color="primary" variant="h6">
            Transaction History
          </Typography>
          <History />
        </div>
      </div>
    </div>
  )
}

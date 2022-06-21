import Typography from '@material-ui/core/Typography'
import useStyles from './useStyles'
import { PnLType, PositionType } from '../../types'
import { PnLTooltip } from '@components/PnLTooltip'
import usePositionNPnL from '@hooks/usePositionNPnL'
import useCurrentPrices from '@hooks/useCurrentPrices'

export default function SqueethPosition() {
  const classes = useStyles()
  const { ethPrice } = useCurrentPrices()

  const {
    positionType,
    realizedPnL,
    unrealizedPnL,
    loading: isPnLLoading,
    realizedPnLInPerct,
    unrealizedPnLInPerct,
    currentOSQTHAmount,
    currentPositionValue,
  } = usePositionNPnL()
  return (
    <div className={classes.position}>
      <div className={classes.positionTitle}>
        <Typography>{positionType === PositionType.LONG ? 'Long' : 'Short'} Squeeth</Typography>
      </div>
      <div className={classes.shortPositionData}>
        <div className={classes.innerPositionData}>
          <div style={{ width: '50%' }}>
            <Typography variant="caption" component="span" color="textSecondary">
              oSQTH Amount
            </Typography>
            <Typography variant="body1">
              {isPnLLoading ? 'Loading' : <span id="pos-page-long-osqth-bal">{currentOSQTHAmount.toFixed(8)}</span>}{' '}
              &nbsp; oSQTH
            </Typography>
          </div>
          <div style={{ width: '50%' }}>
            <Typography variant="caption" component="span" color="textSecondary">
              Position Value
            </Typography>
            <Typography variant="body1">${isPnLLoading ? 'Loading' : currentPositionValue.toFixed(2)}</Typography>
          </div>
        </div>

        <div className={classes.innerPositionData} style={{ marginTop: '16px' }}>
          <div style={{ width: '50%' }}>
            <div className={classes.pnlTitle}>
              <Typography variant="caption" component="span" color="textSecondary">
                Unrealized P&L
              </Typography>
              <PnLTooltip pnlType={PnLType.Unrealized} />
            </div>
            {isPnLLoading ? (
              <Typography variant="body1">Loading</Typography>
            ) : (
              <>
                <Typography variant="body1" className={unrealizedPnL.isLessThan(0) ? classes.red : classes.green}>
                  $ {unrealizedPnL.toFixed(2)} ({unrealizedPnL.div(ethPrice).toFixed(2)}. ETH)
                  {/* ${sellQuote.amountOut.minus(wethAmount.abs()).times(toTokenAmount(index, 18).sqrt()).toFixed(2)}{' '}
              ({sellQuote.amountOut.minus(wethAmount.abs()).toFixed(5)} ETH) */}
                </Typography>
                <Typography variant="caption" className={unrealizedPnL.isLessThan(0) ? classes.red : classes.green}>
                  {(unrealizedPnLInPerct || 0).toFixed(2)}%
                </Typography>
              </>
            )}
          </div>
          <div style={{ width: '50%' }}>
            <div className={classes.pnlTitle}>
              <Typography variant="caption" component="span" color="textSecondary">
                Realized P&L
              </Typography>
              <PnLTooltip pnlType={PnLType.Realized} />
            </div>
            <Typography variant="body1" className={realizedPnL.gte(0) ? classes.green : classes.red}>
              $ {isPnLLoading ? 'Loading' : realizedPnL.toFixed(2)}
            </Typography>
            <Typography variant="caption" className={realizedPnLInPerct.isLessThan(0) ? classes.red : classes.green}>
              {(realizedPnLInPerct || 0).toFixed(2)}%
            </Typography>
          </div>
        </div>
      </div>
    </div>
  )
}

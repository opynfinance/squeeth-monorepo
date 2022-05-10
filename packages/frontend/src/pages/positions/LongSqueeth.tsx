import Typography from '@material-ui/core/Typography'
import { useAtomValue } from 'jotai'
import { useComputeSwaps, useLongRealizedPnl, useLPPositionsQuery } from 'src/state/positions/hooks'
import { loadingAtom } from 'src/state/pnl/atoms'
import useStyles from './useStyles'
import { useBuyAndSellQuote, useLongGain, useLongUnrealizedPNL } from 'src/state/pnl/hooks'
import { toTokenAmount } from '@utils/calculations'
import { indexAtom } from 'src/state/controller/atoms'
import { PnLType } from '../../types'
import { PnLTooltip } from '@components/PnLTooltip'

export default function LongSqueeth() {
  const classes = useStyles()
  const { loading: isPositionLoading } = useLPPositionsQuery()
  const { squeethAmount, loading: swapsLoading } = useComputeSwaps()
  const isPnLLoading = useAtomValue(loadingAtom)
  const { sellQuote } = useBuyAndSellQuote()
  const index = useAtomValue(indexAtom)
  const longGain = useLongGain()
  const longUnrealizedPNL = useLongUnrealizedPNL()
  const longRealizedPNL = useLongRealizedPnl()

  return (
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
              {isPositionLoading && squeethAmount.isEqualTo(0) ? (
                'Loading'
              ) : (
                <span id="pos-page-long-osqth-bal">{squeethAmount.toFixed(8)}</span>
              )}{' '}
              &nbsp; oSQTH
            </Typography>
            <Typography variant="body2" color="textSecondary">
              $
              {isPnLLoading && sellQuote.amountOut.times(toTokenAmount(index, 18).sqrt()).isEqualTo(0)
                ? 'Loading'
                : sellQuote.amountOut.times(toTokenAmount(index, 18).sqrt()).toFixed(2)}
            </Typography>
          </div>
          <div style={{ width: '50%' }}>
            <div className={classes.pnlTitle}>
              <Typography variant="caption" component="span" color="textSecondary">
                Unrealized P&L
              </Typography>
              <PnLTooltip pnlType={PnLType.Unrealized} />
            </div>
            {isPnLLoading || longUnrealizedPNL.loading ? (
              <Typography variant="body1">Loading</Typography>
            ) : (
              <>
                <Typography variant="body1" className={longGain.isLessThan(0) ? classes.red : classes.green}>
                  $ {longUnrealizedPNL.usd.toFixed(2)} ({longUnrealizedPNL.eth.toFixed(5)} ETH)
                  {/* ${sellQuote.amountOut.minus(wethAmount.abs()).times(toTokenAmount(index, 18).sqrt()).toFixed(2)}{' '}
              ({sellQuote.amountOut.minus(wethAmount.abs()).toFixed(5)} ETH) */}
                </Typography>
                <Typography variant="caption" className={longGain.isLessThan(0) ? classes.red : classes.green}>
                  {(longGain || 0).toFixed(2)}%
                </Typography>
              </>
            )}
          </div>
        </div>
        <div className={classes.innerPositionData} style={{ marginTop: '16px' }}>
          <div style={{ width: '50%' }}>
            <div className={classes.pnlTitle}>
              <Typography variant="caption" component="span" color="textSecondary">
                Realized P&L
              </Typography>
              <PnLTooltip pnlType={PnLType.Realized} />
            </div>
            <Typography variant="body1" className={longRealizedPNL.gte(0) ? classes.green : classes.red}>
              $ {swapsLoading ? 'Loading' : longRealizedPNL.toFixed(2)}
            </Typography>
          </div>
        </div>
      </div>
    </div>
  )
}

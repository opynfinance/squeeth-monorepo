import Typography from '@material-ui/core/Typography'
import { useAtomValue } from 'jotai'
import clsx from 'clsx'

import { useComputeSwaps, useLongRealizedPnl, useLPPositionsQuery } from '@state/positions/hooks'
import { loadingAtom } from '@state/pnl/atoms'
import { useLongGain, useCurrentLongPositionValue, useLongUnrealizedPNL } from '@state/pnl/hooks'
import { isToHidePnLAtom } from '@state/positions/atoms'
import { HidePnLText } from '@components/HidePnLText'
import { PnLTooltip } from '@components/PnLTooltip'
import { formatNumber, formatCurrency } from '@utils/formatter'
import { PnLType } from 'src/types'
import useStyles from './useStyles'

const Loading = () => {
  return <Typography variant="body1">loading...</Typography>
}

export default function LongSqueeth() {
  const classes = useStyles()
  const { loading: isPositionLoading } = useLPPositionsQuery()
  const { squeethAmount, loading: swapsLoading } = useComputeSwaps()
  const isPnLLoading = useAtomValue(loadingAtom)
  const isToHidePnL = useAtomValue(isToHidePnLAtom)
  const longGain = useLongGain()
  const longUnrealizedPNL = useLongUnrealizedPNL()
  const longRealizedPNL = useLongRealizedPnl()
  const longPositionValue = useCurrentLongPositionValue()

  return (
    <div className={classes.position}>
      <div className={classes.positionTitle}>
        <Typography>Long Squeeth</Typography>
      </div>
      <div className={classes.shortPositionData}>
        <div className={classes.innerPositionData}>
          <div className={classes.positionColumn}>
            <Typography variant="caption" component="span" color="textSecondary">
              oSQTH Amount
            </Typography>

            {isPositionLoading && squeethAmount.isEqualTo(0) ? (
              <Loading />
            ) : (
              <Typography variant="body1" className={classes.textMonospace}>
                <span id="pos-page-long-osqth-bal">{formatNumber(squeethAmount.toNumber(), 6)}</span> oSQTH
              </Typography>
            )}
          </div>

          <div className={classes.positionColumn}>
            <Typography variant="caption" component="span" color="textSecondary">
              Position Value
            </Typography>

            {isPnLLoading && longPositionValue.isEqualTo(0) ? (
              <Loading />
            ) : (
              <Typography variant="body1" className={classes.textMonospace}>
                {formatCurrency(longPositionValue.toNumber())}
              </Typography>
            )}
          </div>
        </div>

        <div className={classes.rowMarginTop}>
          {isToHidePnL ? (
            <HidePnLText isSmall />
          ) : (
            <div className={classes.innerPositionData}>
              <div className={classes.positionColumn}>
                <div className={classes.pnlTitle}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Unrealized P&L
                  </Typography>
                  <PnLTooltip pnlType={PnLType.Unrealized} />
                </div>

                {isPnLLoading || longUnrealizedPNL.loading ? (
                  <Loading />
                ) : (
                  <>
                    <Typography
                      variant="body1"
                      className={clsx(classes.textMonospace, longGain.isLessThan(0) ? classes.red : classes.green)}
                    >
                      {formatCurrency(longUnrealizedPNL.usd.toNumber())} (
                      {formatNumber(longUnrealizedPNL.eth.toNumber(), 4)} ETH)
                    </Typography>
                    <Typography
                      variant="caption"
                      className={clsx(classes.textMonospace, longGain.isLessThan(0) ? classes.red : classes.green)}
                    >
                      {longGain.isPositive() && '+'}
                      {formatNumber(longGain.toNumber() || 0)}%
                    </Typography>
                  </>
                )}
              </div>
              <div className={classes.positionColumn}>
                <div className={classes.pnlTitle}>
                  <Typography variant="caption" component="span" color="textSecondary">
                    Realized P&L
                  </Typography>
                  <PnLTooltip pnlType={PnLType.Realized} />
                </div>

                {swapsLoading ? (
                  <Loading />
                ) : (
                  <Typography
                    variant="body1"
                    className={clsx(classes.textMonospace, longRealizedPNL.gte(0) ? classes.green : classes.red)}
                  >
                    {formatCurrency(longRealizedPNL.toNumber())}
                  </Typography>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

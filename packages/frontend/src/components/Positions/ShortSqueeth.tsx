import { Tooltip, Typography } from '@material-ui/core'
import { useAtomValue } from 'jotai'
import Link from 'next/link'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import BigNumber from 'bignumber.js'
import clsx from 'clsx'

import { useComputeSwaps, useFirstValidVault, useLPPositionsQuery, useShortRealizedPnl } from '@state/positions/hooks'
import { loadingAtom } from '@state/crab/atoms'
import { useCurrentShortPositionValue, useShortGain, useShortUnrealizedPNL } from '@state/pnl/hooks'
import { Tooltips } from '@constants/index'
import { useVaultData } from '@hooks/useVaultData'
import { HidePnLText } from '@components/HidePnLText'
import { isToHidePnLAtom } from '@state/positions/atoms'
import { PnLType } from 'src/types'
import { PnLTooltip } from '@components/PnLTooltip'
import { formatCurrency, formatNumber } from '@utils/formatter'
import useStyles from './useStyles'

const Loading = () => {
  return <Typography variant="body1">loading...</Typography>
}

export default function ShortSqueeth() {
  const classes = useStyles()
  const { validVault, vaultId, isVaultLoading } = useFirstValidVault()
  const { existingCollat, existingLiqPrice, existingCollatPercent } = useVaultData(validVault)
  const { loading: isPositionLoading } = useLPPositionsQuery()
  const { squeethAmount, loading: swapsLoading } = useComputeSwaps()
  const isPnLLoading = useAtomValue(loadingAtom)
  const shortPositionValue = useCurrentShortPositionValue()
  const shortGain = useShortGain()
  const shortUnrealizedPNL = useShortUnrealizedPNL()
  const shortRealizedPNL = useShortRealizedPnl()
  const isToHidePnL = useAtomValue(isToHidePnLAtom)

  return (
    <div className={classes.position}>
      <div className={classes.positionTitle}>
        <Typography>Short Squeeth</Typography>
        <Typography className={classes.link}>
          <Link href={`vault/${vaultId}`}>Manage</Link>
        </Typography>
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
              <Typography variant="body1">
                <Typography component="span" id="pos-page-short-osqth-bal" className={classes.textMonospace}>
                  {formatNumber(squeethAmount.toNumber(), 6)}
                </Typography>
                &nbsp; oSQTH
              </Typography>
            )}
          </div>
          <div className={classes.positionColumn}>
            <Typography variant="caption" component="span" color="textSecondary">
              Position Value
            </Typography>

            {isPnLLoading && shortPositionValue.isEqualTo(0) ? (
              <Loading />
            ) : (
              <Typography variant="body1" className={classes.textMonospace}>
                {formatCurrency(shortPositionValue.toNumber())}
              </Typography>
            )}
          </div>
        </div>
        <div className={classes.innerPositionData} style={{ marginTop: '16px' }}>
          <div className={classes.positionColumn}>
            <div className={classes.titleWithTooltip}>
              <Typography variant="caption" color="textSecondary">
                Liquidation Price
              </Typography>
              <Tooltip title={Tooltips.LiquidationPrice}>
                <InfoIcon fontSize="small" className={classes.infoIcon} />
              </Tooltip>
            </div>

            {isVaultLoading && existingLiqPrice.isEqualTo(0) ? (
              <Loading />
            ) : (
              <Typography variant="body1" className={classes.textMonospace}>
                {formatCurrency(existingLiqPrice.toNumber())}
              </Typography>
            )}
          </div>
          <div className={classes.positionColumn}>
            <Typography variant="caption" component="span" color="textSecondary">
              Collateral (Amt / Ratio)
            </Typography>

            {isVaultLoading && existingCollat.isEqualTo(0) ? (
              <Loading />
            ) : (
              <Typography variant="body1" className={classes.textMonospace}>
                {formatNumber(existingCollat.toNumber(), 4)} ETH ({formatNumber(existingCollatPercent)}%)
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

                {isPositionLoading || shortUnrealizedPNL.loading ? (
                  <Loading />
                ) : (
                  <>
                    <Typography
                      variant="body1"
                      className={clsx(classes.textMonospace, shortGain.isLessThan(0) ? classes.red : classes.green)}
                    >
                      {formatCurrency(shortUnrealizedPNL.usd.toNumber())} (
                      {formatNumber(shortUnrealizedPNL.eth.toNumber(), 4)} ETH)
                    </Typography>
                    <Typography
                      variant="caption"
                      className={clsx(classes.textMonospace, shortGain.isLessThan(0) ? classes.red : classes.green)}
                    >
                      {shortGain.isPositive() && '+'}
                      {formatNumber(shortGain?.toNumber() ?? 0)}%
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
                    className={clsx(classes.textMonospace, shortRealizedPNL.gte(0) ? classes.green : classes.red)}
                  >
                    {formatCurrency(shortRealizedPNL.toNumber())}
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

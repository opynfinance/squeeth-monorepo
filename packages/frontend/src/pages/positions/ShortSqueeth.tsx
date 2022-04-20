import { Tooltip, Typography } from '@material-ui/core'
import {
  useComputeSwaps,
  useFirstValidVault,
  useLPPositionsQuery,
  useShortRealizedPnl,
} from 'src/state/positions/hooks'
import useStyles from './useStyles'
import Link from 'next/link'
import { useAtomValue } from 'jotai'
import { loadingAtom } from 'src/state/crab/atoms'
import { useBuyAndSellQuote, useShortGain, useShortUnrealizedPNL } from 'src/state/pnl/hooks'
import { toTokenAmount } from '@utils/calculations'
import { indexAtom } from 'src/state/controller/atoms'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import { Tooltips } from '../../constants'
import { useVaultData } from '@hooks/useVaultData'

export default function ShortSqueeth() {
  const classes = useStyles()
  const { vaultId } = useFirstValidVault()
  const {
    existingCollat,
    existingLiqPrice,
    existingCollatPercent,
    isVaultLoading: isVaultDataLoading,
  } = useVaultData(vaultId)
  const { loading: isPositionLoading } = useLPPositionsQuery()
  const { squeethAmount } = useComputeSwaps()
  const isPnLLoading = useAtomValue(loadingAtom)
  const { buyQuote } = useBuyAndSellQuote()
  const index = useAtomValue(indexAtom)
  const shortGain = useShortGain()
  const shortUnrealizedPNL = useShortUnrealizedPNL()
  const shortRealizedPNL = useShortRealizedPnl()

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
          <div style={{ width: '50%' }}>
            <Typography variant="caption" component="span" color="textSecondary">
              Position
            </Typography>
            {isPositionLoading ? (
              <Typography variant="body1">Loading</Typography>
            ) : (
              <>
                <Typography variant="body1" id="pos-page-short-osqth-bal">
                  {squeethAmount.toFixed(8) + ' oSQTH'}
                </Typography>{' '}
                <Typography variant="body2" color="textSecondary">
                  {isPnLLoading && buyQuote.times(toTokenAmount(index, 18).sqrt()).isEqualTo(0)
                    ? 'Loading'
                    : '$' + buyQuote.times(toTokenAmount(index, 18).sqrt()).toFixed(2)}
                </Typography>
              </>
            )}
          </div>
          <div style={{ width: '50%' }}>
            <Typography variant="caption" color="textSecondary">
              Unrealized P&L
            </Typography>
            <Tooltip
              title={Tooltips.UnrealizedPnL}
              // title={isLong ? Tooltips.UnrealizedPnL : `${Tooltips.UnrealizedPnL}. ${Tooltips.ShortCollateral}`}
            >
              <InfoIcon fontSize="small" className={classes.infoIcon} />
            </Tooltip>
            {isPositionLoading ||
            shortGain.isLessThanOrEqualTo(-100) ||
            !shortGain.isFinite() ||
            shortUnrealizedPNL.loading ? (
              <Typography variant="body1">Loading</Typography>
            ) : (
              <>
                <Typography variant="body1" className={shortGain.isLessThan(0) ? classes.red : classes.green}>
                  $ {shortUnrealizedPNL.usd.toFixed(2)} ({shortUnrealizedPNL.eth.toFixed(5)} ETH)
                  {/* $ {shortUnrealizedPNL.usd.toFixed(2)} ({wethAmount.minus(buyQuote).toFixed(5)} ETH) */}
                </Typography>
                <Typography variant="caption" className={shortGain.isLessThan(0) ? classes.red : classes.green}>
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
            <Tooltip title={Tooltips.LiquidationPrice}>
              <InfoIcon fontSize="small" className={classes.infoIcon} />
            </Tooltip>
            <Typography variant="body1">
              {isVaultDataLoading && existingLiqPrice.isEqualTo(0) ? 'Loading' : '$' + existingLiqPrice.toFixed(2)}
            </Typography>
          </div>
          <div style={{ width: '50%' }}>
            <Typography variant="caption" component="span" color="textSecondary">
              Collateral (Amt / Ratio)
            </Typography>
            <Typography variant="body1">
              {isVaultDataLoading && existingCollat.isEqualTo(0) ? 'Loading' : existingCollat.toFixed(4)} ETH (
              {existingCollatPercent}%)
            </Typography>
          </div>
        </div>
        <div className={classes.innerPositionData} style={{ marginTop: '16px' }}>
          <div style={{ width: '50%' }}>
            <Typography variant="caption" component="span" color="textSecondary">
              Realized P&L
            </Typography>
            <Tooltip title={Tooltips.RealizedPnL}>
              <InfoIcon fontSize="small" className={classes.infoIcon} />
            </Tooltip>
            <Typography variant="body1" className={shortRealizedPNL.gte(0) ? classes.green : classes.red}>
              $ {isPnLLoading && shortRealizedPNL.isEqualTo(0) ? 'Loading' : shortRealizedPNL.toFixed(2)}
            </Typography>
          </div>
        </div>
      </div>
    </div>
  )
}

import { Tooltip, Typography } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import { useAtomValue } from 'jotai'
import { useEffect } from 'react'
import InfoIcon from '@material-ui/icons/InfoOutlined'

import { useCurrentCrabPositionValue, useCurrentCrabPositionValueV2, useSetStrategyData } from '@state/crab/hooks'
import { crabStrategyCollatRatioAtom, usdcQueuedAtom, crabQueuedAtom, crabUSDValueAtom } from '@state/crab/atoms'
import { Tooltips, USDC_DECIMALS } from '@constants/index'
import { toTokenAmount } from '@utils/calculations'
import { formatCurrency } from '@utils/formatter'
import useStyles from './useStyles'

type CrabPositionV2Type = {
  depositedEth: BigNumber
  depositedUsd: BigNumber
  loading: boolean
  pnlWMidPriceInUSD: BigNumber
  pnlWMidPriceInPerct: BigNumber
  currentCrabPositionValue: BigNumber
  currentCrabPositionValueInETH: BigNumber
  version: String
}

const CrabPositionV2: React.FC<CrabPositionV2Type> = ({
  depositedEth,
  depositedUsd,
  loading,
  pnlWMidPriceInPerct,
  pnlWMidPriceInUSD,
  currentCrabPositionValue,
  currentCrabPositionValueInETH,
  version,
}) => {
  const classes = useStyles()
  const collatRatio = useAtomValue(crabStrategyCollatRatioAtom)
  const usdcQueued = useAtomValue(usdcQueuedAtom)
  const crabQueued = useAtomValue(crabQueuedAtom)
  const crabUsdValue = useAtomValue(crabUSDValueAtom)

  const setStrategyData = useSetStrategyData()
  useCurrentCrabPositionValue()
  useCurrentCrabPositionValueV2()

  useEffect(() => {
    setStrategyData()
  }, [collatRatio, setStrategyData])

  const initiatedDepositAmount = toTokenAmount(usdcQueued, USDC_DECIMALS)
  const initiatedWithdrawalAmount = toTokenAmount(crabQueued, 18).times(toTokenAmount(crabUsdValue, 18))

  return (
    <div className={classes.position} id="pos-page-crab">
      <div className={classes.positionTitle}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Typography>🦀</Typography>
          <Typography style={{ marginLeft: '8px' }}>{version}</Typography>
        </div>
      </div>
      <div className={classes.shortPositionData}>
        <div className={classes.innerPositionData}>
          <div style={{ width: '50%' }}>
            <Typography variant="caption" component="span" color="textSecondary">
              Deposited Amount
            </Typography>
            <Tooltip title={Tooltips.CrabMigratedDeposit}>
              <InfoIcon fontSize="small" className={classes.infoIcon} />
            </Tooltip>
            <Typography variant="body1">$ {depositedUsd.toFixed(2)}</Typography>
            <Typography variant="body2" color="textSecondary">
              <span id="pos-page-crab-deposited-amount">{depositedEth.toFixed(6)}</span>
              &nbsp; ETH
            </Typography>
          </div>
          <div style={{ width: '50%' }}>
            <Typography variant="caption" component="span" color="textSecondary">
              Current Position
            </Typography>
            <Typography variant="body1">{!loading ? `$ ${currentCrabPositionValue.toFixed(2)}` : 'Loading'}</Typography>
            <Typography variant="body2" color="textSecondary">
              {!loading ? `${currentCrabPositionValueInETH.toFixed(6)}  ETH` : 'Loading'}
            </Typography>
          </div>
        </div>
        <div className={classes.innerPositionData} style={{ marginTop: '16px' }}>
          <div style={{ width: '50%' }}>
            <Typography variant="caption" component="span" color="textSecondary">
              Unrealized P&L
            </Typography>
            <Tooltip title={Tooltips.CrabPnL}>
              <InfoIcon fontSize="small" className={classes.infoIcon} />
            </Tooltip>
            <Typography
              variant="body1"
              className={pnlWMidPriceInUSD.isLessThan(0) ? classes.red : classes.green}
              id="pos-page-crab-pnl-amount"
            >
              {!loading ? '$' + `${pnlWMidPriceInUSD.toFixed(2)}` : 'Loading'}
            </Typography>
            <Typography variant="caption" className={pnlWMidPriceInPerct.isLessThan(0) ? classes.red : classes.green}>
              {!loading ? `${pnlWMidPriceInPerct.toFixed(2)}` + '%' : 'Loading'}
            </Typography>
          </div>
        </div>

        <div className={classes.innerPositionData}>
          {/* ignore dust amount */}
          {usdcQueued.isGreaterThan('100') && (
            <div style={{ width: '50%', marginTop: '16px' }}>
              <Typography variant="caption" component="span" color="textSecondary">
                Initiated Deposit
              </Typography>
              <Tooltip title={Tooltips.InitiatedDeposit}>
                <InfoIcon fontSize="small" className={classes.infoIcon} />
              </Tooltip>
              <Typography variant="body1">
                {!loading ? formatCurrency(Number(initiatedDepositAmount)) : 'Loading'}
              </Typography>
            </div>
          )}

          {/* ignore dust amount */}
          {crabQueued.isGreaterThan('10000000000') && (
            <div style={{ width: '50%', marginTop: '16px' }}>
              <Typography variant="caption" component="span" color="textSecondary">
                Initiated Withdrawal
              </Typography>
              <Tooltip title={Tooltips.InitiatedWithdrawal}>
                <InfoIcon fontSize="small" className={classes.infoIcon} />
              </Tooltip>
              <Typography variant="body1">
                {!loading ? formatCurrency(Number(initiatedWithdrawalAmount)) : 'Loading'}
              </Typography>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CrabPositionV2

import { Tooltip, Typography } from '@material-ui/core'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import { useAtomValue } from 'jotai'
import Image from 'next/image'

import { Tooltips, WETH_DECIMALS, ZENBULL_TOKEN_DECIMALS } from '@constants/index'
import {
  bullCurrentETHPositionAtom,
  bullCurrentUSDCPositionAtom,
  bullDepositedETHAtom,
  bullDepositedUSDCAtom,
  bullEthPnlAtom,
  bullEthPnlPerctAtom,
  bullPositionLoadedAtom,
  ethQueuedAtom,
  zenBullQueuedAtom,
  bullEthValuePerShareAtom,
} from '@state/bull/atoms'
import { toTokenAmount } from '@utils/calculations'
import { formatNumber } from '@utils/formatter'
import bullStrategyImg from 'public/images/bull_strategy.png'
import useStyles from './useStyles'

const BullPosition: React.FC = () => {
  const classes = useStyles()
  const bullCurrentETH = useAtomValue(bullCurrentETHPositionAtom)
  const bullCurrentUSD = useAtomValue(bullCurrentUSDCPositionAtom)

  const bullDepositedETH = useAtomValue(bullDepositedETHAtom)
  const bullDepositedUSD = useAtomValue(bullDepositedUSDCAtom)

  const bullEthPnl = useAtomValue(bullEthPnlAtom)
  const bullEthPnlInPerct = useAtomValue(bullEthPnlPerctAtom)

  const ethQueued = useAtomValue(ethQueuedAtom)
  const zenBullQueued = useAtomValue(zenBullQueuedAtom)
  const bullEthValue = useAtomValue(bullEthValuePerShareAtom)

  const loading = !useAtomValue(bullPositionLoadedAtom)

  if (bullCurrentETH.isZero() && ethQueued.isZero() && zenBullQueued.isZero()) {
    return null
  }

  const initiatedDepositAmount = toTokenAmount(ethQueued, WETH_DECIMALS)
  const initiatedWithdrawalAmount = toTokenAmount(zenBullQueued, ZENBULL_TOKEN_DECIMALS).times(bullEthValue)

  return (
    <div className={classes.position} id="pos-page-bull">
      <div className={classes.positionTitle}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div className={classes.emoji}>
            <Image src={bullStrategyImg} width="100%" alt="zen bull" />
          </div>
          <Typography style={{ marginLeft: '8px' }}>Zen Bull</Typography>
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
            <Typography variant="body1">{bullDepositedETH.toFixed(6)}&nbsp;ETH</Typography>
            <Typography variant="body2" color="textSecondary">
              <span id="pos-page-bull-deposited-amount">${bullDepositedUSD.toFixed(2)}</span>
            </Typography>
          </div>
          <div style={{ width: '50%' }}>
            <Typography variant="caption" component="span" color="textSecondary">
              Current Position
            </Typography>
            <Typography variant="body1">{!loading ? `${bullCurrentETH.toFixed(6)}` : 'Loading'} ETH</Typography>
            <Typography variant="body2" color="textSecondary">
              {!loading ? `$${bullCurrentUSD.toFixed(2)}` : 'Loading'}
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
              className={bullEthPnl.isLessThan(0) ? classes.red : classes.green}
              id="pos-page-bull-pnl-amount"
            >
              {!loading ? `${bullEthPnl.toFixed(6)} ETH` : 'Loading'}
            </Typography>
            <Typography variant="caption" className={bullEthPnlInPerct.isLessThan(0) ? classes.red : classes.green}>
              {!loading ? `${bullEthPnlInPerct.toFixed(2)}` + '%' : 'Loading'}
            </Typography>
          </div>
        </div>

        <div className={classes.innerPositionData}>
          {/* ignore dust amount */}
          {ethQueued.isGreaterThan('10000000000') && (
            <div style={{ width: '50%', marginTop: '16px' }}>
              <Typography variant="caption" component="span" color="textSecondary">
                Initiated Deposit
              </Typography>
              <Tooltip title={Tooltips.InitiatedDeposit}>
                <InfoIcon fontSize="small" className={classes.infoIcon} />
              </Tooltip>
              <Typography variant="body1">
                {!loading ? formatNumber(Number(initiatedDepositAmount), 4) + ' ETH' : 'Loading'}
              </Typography>
            </div>
          )}

          {/* ignore dust amount */}
          {zenBullQueued.isGreaterThan('10000000000') && (
            <div style={{ width: '50%', marginTop: '16px' }}>
              <Typography variant="caption" component="span" color="textSecondary">
                Initiated Withdrawal
              </Typography>
              <Tooltip title={Tooltips.InitiatedWithdrawal}>
                <InfoIcon fontSize="small" className={classes.infoIcon} />
              </Tooltip>
              <Typography variant="body1">
                {!loading ? formatNumber(Number(initiatedWithdrawalAmount), 4) + ' ETH' : 'Loading'}
              </Typography>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default BullPosition

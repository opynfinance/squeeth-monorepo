import { Tooltip, Typography } from '@material-ui/core'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import useStyles from './useStyles'
import { Tooltips } from '../../constants'
import { useAtomValue } from 'jotai'
import {
  bullCurrentETHPositionAtom,
  bullCurrentUSDCPositionAtom,
  bullDepositedETHAtom,
  bullDepositedUSDCAtom,
  bullEthPnlAtom,
  bullEthPnlPerctAtom,
  bullPositionLoadedAtom,
  isBullReadyAtom,
} from '@state/bull/atoms'

const BullPosition: React.FC = () => {
  const classes = useStyles()
  const bullCurrentETH = useAtomValue(bullCurrentETHPositionAtom)
  const bullCurrentUSD = useAtomValue(bullCurrentUSDCPositionAtom)

  const bullDepositedETH = useAtomValue(bullDepositedETHAtom)
  const bullDepositedUSD = useAtomValue(bullDepositedUSDCAtom)

  const bullEthPnl = useAtomValue(bullEthPnlAtom)
  const bullEthPnlInPerct = useAtomValue(bullEthPnlPerctAtom)

  const loading = !useAtomValue(bullPositionLoadedAtom)

  if (bullCurrentETH.isZero()) return null

  return (
    <div className={classes.position} id="pos-page-bull">
      <div className={classes.positionTitle}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Typography>🐂</Typography>
          <Typography style={{ marginLeft: '8px' }}>Bull</Typography>
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
              <span id="pos-page-crab-deposited-amount">${bullDepositedUSD.toFixed(2)}</span>
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
              id="pos-page-crab-pnl-amount"
            >
              {!loading ? `${bullEthPnl.toFixed(6)} ETH` : 'Loading'}
            </Typography>
            <Typography variant="caption" className={bullEthPnlInPerct.isLessThan(0) ? classes.red : classes.green}>
              {!loading ? `${bullEthPnlInPerct.toFixed(2)}` + '%' : 'Loading'}
            </Typography>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BullPosition

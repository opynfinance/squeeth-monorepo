import { Tooltip, Typography } from '@material-ui/core'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import Image from 'next/image'
import { useAtomValue } from 'jotai'
import React from 'react'
import clsx from 'clsx'

import { Tooltips } from '@constants/index'
import {
  bullCurrentETHPositionAtom,
  bullCurrentUSDCPositionAtom,
  bullDepositedETHAtom,
  bullDepositedUSDCAtom,
  bullEthPnlAtom,
  bullEthPnlPerctAtom,
  bullPositionLoadedAtom,
} from '@state/bull/atoms'
import bullStrategyImg from 'public/images/bull_strategy.png'
import { formatCurrency, formatNumber } from '@utils/formatter'
import Loading from './Loading'
import useStyles from './useStyles'

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
          <div className={classes.emoji}>
            <Image src={bullStrategyImg} width="100%" alt="zen bull" />
          </div>
          <Typography style={{ marginLeft: '8px' }} variant="body1" className={classes.fontMedium}>
            Zen Bull
          </Typography>
        </div>
      </div>
      <div className={classes.shortPositionData}>
        <div className={classes.innerPositionData}>
          <div className={classes.positionColumn}>
            <div className={classes.titleWithTooltip}>
              <Typography variant="caption" component="span" color="textSecondary">
                Deposited Amount
              </Typography>
              <Tooltip title={Tooltips.CrabMigratedDeposit}>
                <InfoIcon fontSize="small" className={classes.infoIcon} />
              </Tooltip>
            </div>

            <Typography variant="body1" className={classes.textMonospace}>
              {formatNumber(bullDepositedETH.toNumber(), 6)}&nbsp;ETH
            </Typography>
            <Typography variant="body2" color="textSecondary" className={classes.textMonospace}>
              <span id="pos-page-crab-deposited-amount">{formatCurrency(bullDepositedUSD.toNumber())}</span>
            </Typography>
          </div>

          <div className={classes.positionColumn}>
            <Typography variant="caption" component="span" color="textSecondary">
              Current Position
            </Typography>
            {loading ? (
              <Loading />
            ) : (
              <Typography variant="body1" className={classes.textMonospace}>
                {formatNumber(bullCurrentETH.toNumber(), 6)} ETH
              </Typography>
            )}
            {loading ? (
              <Loading isSmall />
            ) : (
              <Typography variant="body2" color="textSecondary" className={classes.textMonospace}>
                {formatCurrency(bullCurrentUSD.toNumber())}
              </Typography>
            )}
          </div>
        </div>

        <div className={clsx(classes.innerPositionData, classes.rowMarginTop)}>
          <div className={classes.positionColumn}>
            <div className={classes.titleWithTooltip}>
              <Typography variant="caption" component="span" color="textSecondary">
                Unrealized P&L
              </Typography>
              <Tooltip title={Tooltips.CrabPnL}>
                <InfoIcon fontSize="small" className={classes.infoIcon} />
              </Tooltip>
            </div>

            {loading ? (
              <Loading />
            ) : (
              <Typography
                variant="body1"
                className={clsx(classes.textMonospace, bullEthPnl.isLessThan(0) ? classes.red : classes.green)}
                id="pos-page-crab-pnl-amount"
              >
                {formatNumber(bullEthPnl.toNumber(), 6) + ' ETH'}
              </Typography>
            )}
            {loading ? (
              <Loading isSmall />
            ) : (
              <Typography
                variant="caption"
                className={clsx(classes.textMonospace, bullEthPnlInPerct.isLessThan(0) ? classes.red : classes.green)}
              >
                {bullEthPnlInPerct.isPositive() && '+'}
                {formatNumber(bullEthPnlInPerct.toNumber()) + '%'}
              </Typography>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default BullPosition

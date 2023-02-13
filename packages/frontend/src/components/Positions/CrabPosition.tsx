import React, { useEffect } from 'react'
import { Tooltip, Typography } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import { useAtomValue } from 'jotai'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import clsx from 'clsx'

import { useCurrentCrabPositionValue, useCurrentCrabPositionValueV2, useSetStrategyData } from '@state/crab/hooks'
import { crabStrategyCollatRatioAtom } from '@state/crab/atoms'
import { Tooltips } from '@constants/index'
import { formatCurrency, formatNumber } from '@utils/formatter'
import Loading from './Loading'
import useStyles from './useStyles'

type CrabPositionType = {
  depositedEth: BigNumber
  depositedUsd: BigNumber
  loading: boolean
  pnlWMidPriceInUSD: BigNumber
  pnlWMidPriceInPerct: BigNumber
  currentCrabPositionValue: BigNumber
  currentCrabPositionValueInETH: BigNumber
  version: String
}

const CrabPosition: React.FC<CrabPositionType> = ({
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
  const setStrategyData = useSetStrategyData()
  useCurrentCrabPositionValue()
  useCurrentCrabPositionValueV2()

  useEffect(() => {
    setStrategyData()
  }, [collatRatio, setStrategyData])

  return (
    <div className={classes.position} id="pos-page-crab">
      <div className={classes.positionTitle}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Typography>🦀</Typography>
          <Typography style={{ marginLeft: '8px' }} variant="body1" className={classes.fontMedium}>
            {version}
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
              {formatCurrency(depositedUsd.toNumber())}
            </Typography>
            <Typography variant="body2" color="textSecondary" className={classes.textMonospace}>
              <span id="pos-page-crab-deposited-amount">{formatNumber(depositedEth.toNumber(), 4)} ETH</span>
            </Typography>
          </div>

          <div className={classes.positionColumn}>
            <Typography variant="caption" color="textSecondary">
              Current Position
            </Typography>
            {loading ? (
              <Loading />
            ) : (
              <>
                <Typography variant="body1" className={classes.textMonospace}>
                  {formatCurrency(currentCrabPositionValue.toNumber())}
                </Typography>
                <Typography variant="body2" color="textSecondary" className={classes.textMonospace}>
                  {formatNumber(currentCrabPositionValueInETH.toNumber(), 4)} ETH
                </Typography>
              </>
            )}
          </div>
        </div>
        <div className={classes.innerPositionData} style={{ marginTop: '16px' }}>
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
                className={clsx(classes.textMonospace, pnlWMidPriceInUSD.isLessThan(0) ? classes.red : classes.green)}
                id="pos-page-crab-pnl-amount"
              >
                {formatCurrency(pnlWMidPriceInUSD.toNumber())}
              </Typography>
            )}

            {loading ? (
              <Loading isSmall />
            ) : (
              <Typography
                variant="caption"
                className={clsx(classes.textMonospace, pnlWMidPriceInPerct.isLessThan(0) ? classes.red : classes.green)}
              >
                {pnlWMidPriceInPerct.isPositive() && '+'}
                {formatNumber(pnlWMidPriceInPerct.toNumber(), 2) + '%'}
              </Typography>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CrabPosition

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
import useStyles from './useStyles'

const Loading: React.FC<{ isSmall?: boolean }> = ({ isSmall = false }) => {
  return <Typography variant={isSmall ? 'caption' : 'body1'}>loading...</Typography>
}

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
  depositedUsd,
  loading,
  pnlWMidPriceInPerct,
  pnlWMidPriceInUSD,
  currentCrabPositionValue,
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
          <Typography style={{ marginLeft: '8px' }}>{version}</Typography>
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
          </div>

          <div className={classes.positionColumn}>
            <Typography variant="caption" color="textSecondary">
              Current Position
            </Typography>
            {loading ? (
              <Loading />
            ) : (
              <Typography variant="body1" className={classes.textMonospace}>
                {formatCurrency(currentCrabPositionValue.toNumber())}
              </Typography>
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

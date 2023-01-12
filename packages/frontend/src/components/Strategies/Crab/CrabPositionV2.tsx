import { Typography, Box, CircularProgress, Button } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React, { memo, useState } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import clsx from 'clsx'

import { addressAtom } from '@state/wallet/atoms'
import { useCurrentCrabPositionValueV2, useDeQueueDepositUSDC, useDeQueueWithdrawCrab } from '@state/crab/hooks'
import useAppMemo from '@hooks/useAppMemo'
import { useCrabPositionV2 } from '@hooks/useCrabPosition/useCrabPosition'
import Metric, { MetricLabel } from '@components/Metric'
import { formatCurrency, formatNumber } from '@utils/formatter'
import { pnlInPerctv2 } from 'src/lib/pnl'
import {
  crabQueuedAtom,
  crabQueuedInUsdAtom,
  crabUSDValueAtom,
  usdcQueuedAtom,
  isNettingAuctionLiveAtom,
} from '@state/crab/atoms'
import { toTokenAmount } from '@utils/calculations'
import { BIG_ZERO, USDC_DECIMALS } from '@constants/index'
import { useTransactionStatus } from '@state/wallet/hooks'
import { Tooltips } from '@constants/enums'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      marginTop: theme.spacing(2),
    },
    subtitle: {
      fontSize: '22px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    green: {
      color: theme.palette.success.main,
    },
    red: {
      color: theme.palette.error.main,
    },
    white: {
      color: 'rgba(255, 255, 255)',
    },
    infoIcon: {
      fontSize: '10px',
      marginLeft: theme.spacing(0.5),
    },
    metricValue: {
      fontSize: '20px',
      fontWeight: 500,
      width: 'max-content',
      fontFamily: 'DM Mono',
    },
    metricSubValue: {
      fontSize: '18px',
      fontWeight: 500,
      width: 'max-content',
      fontFamily: 'DM Mono',
    },
    queuedPosition: {
      display: 'flex',
      alignItems: 'center',
    },
  }),
)

const CrabPosition: React.FC = () => {
  const address = useAtomValue(addressAtom)
  const { loading: isCrabPositionLoading, depositedUsd } = useCrabPositionV2(address || '')
  const { currentCrabPositionValue, isCrabPositionValueLoading } = useCurrentCrabPositionValueV2()

  const [usdcQueued, setUsdcQueued] = useAtom(usdcQueuedAtom)
  const [crabQueued, setCrabQueued] = useAtom(crabQueuedAtom)
  const crabV2QueuedInUsd = useAtomValue(crabQueuedInUsdAtom)
  const isNettingAuctionLive = useAtomValue(isNettingAuctionLiveAtom)

  const classes = useStyles()
  const pnl = useAppMemo(() => {
    console.log(currentCrabPositionValue.toString(), depositedUsd.toString(), 'Position value')
    return pnlInPerctv2(currentCrabPositionValue.plus(crabV2QueuedInUsd), depositedUsd)
  }, [currentCrabPositionValue, depositedUsd, crabV2QueuedInUsd])

  const loading = useAppMemo(() => {
    return isCrabPositionLoading || isCrabPositionValueLoading
  }, [isCrabPositionLoading, isCrabPositionValueLoading])

  const crabUsdValue = useAtomValue(crabUSDValueAtom)

  const [usdcLoading, setUSDCLoading] = useState(false)
  const [crabLoading, setCrabLoading] = useState(false)

  const dequeueUSDC = useDeQueueDepositUSDC()
  const dequeueCRAB = useDeQueueWithdrawCrab()

  const { resetTransactionData } = useTransactionStatus()

  const onDeQueueUSDC = async () => {
    setUSDCLoading(true)
    try {
      await dequeueUSDC(usdcQueued, resetTransactionData)
      setUsdcQueued(BIG_ZERO)
    } catch (e) {
      console.log(e)
    }
    setUSDCLoading(false)
  }

  const onDeQueueCrab = async () => {
    setCrabLoading(true)
    try {
      await dequeueCRAB(crabQueued, resetTransactionData)
      setCrabQueued(BIG_ZERO)
    } catch (e) {
      console.log(e)
    }
    setCrabLoading(false)
  }

  if (currentCrabPositionValue.isZero() && usdcQueued.isZero() && crabQueued.isZero()) return null

  return (
    <Box>
      <Typography variant="h4" className={classes.subtitle}>
        My Position
      </Typography>

      {loading ? (
        <Box mt={2} display="flex" alignItems="flex-start" gridGap="20px" height="94px">
          <CircularProgress color="primary" size="1rem" />
          <Typography>Fetching current position...</Typography>
        </Box>
      ) : (
        <Box display="flex" alignItems="center" gridGap="20px" marginTop="16px" flexWrap="wrap">
          {/* hide position for dust amount */}
          {usdcQueued.isGreaterThan('100') ? (
            <Metric
              label={<MetricLabel label="Initiated Deposit" tooltipTitle={Tooltips.InitiatedDeposit} />}
              value={
                <Box className={classes.queuedPosition}>
                  <Typography className={clsx(classes.metricValue, classes.white)}>
                    {formatCurrency(Number(toTokenAmount(usdcQueued, USDC_DECIMALS)))}
                  </Typography>
                  {!isNettingAuctionLive && (
                    <Button
                      style={{ marginLeft: '8px' }}
                      color="primary"
                      disabled={usdcLoading}
                      onClick={onDeQueueUSDC}
                    >
                      {!usdcLoading ? 'Cancel' : <CircularProgress color="primary" size="1.5rem" />}
                    </Button>
                  )}
                </Box>
              }
            />
          ) : null}
          {/* hide position for dust amount */}
          {crabQueued.isGreaterThan('10000000000') ? (
            <Metric
              label={<MetricLabel label="Initiated Withdrawal" tooltipTitle={Tooltips.InitiatedWithdrawal} />}
              value={
                <Box className={classes.queuedPosition}>
                  <Typography className={clsx(classes.metricValue, classes.white)}>
                    {formatCurrency(Number(toTokenAmount(crabQueued, 18).times(toTokenAmount(crabUsdValue, 18))))}
                  </Typography>
                  {!isNettingAuctionLive && (
                    <Button
                      style={{ marginLeft: '8px' }}
                      color="primary"
                      disabled={crabLoading}
                      onClick={onDeQueueCrab}
                    >
                      {!crabLoading ? 'Cancel' : <CircularProgress color="primary" size="1.5rem" />}
                    </Button>
                  )}
                </Box>
              }
            />
          ) : null}
          {currentCrabPositionValue.isGreaterThan(0) ? (
            <Metric
              label="Position value"
              value={
                <Typography className={clsx(classes.metricValue, classes.white)}>
                  {formatCurrency(currentCrabPositionValue.toNumber())}
                </Typography>
              }
            />
          ) : null}
          {pnl.isFinite() && (
            <Metric
              label="PnL"
              value={
                <Box display="flex" alignItems="center" gridGap="12px">
                  <Typography className={clsx(classes.metricValue, classes.white)}>
                    {formatCurrency(depositedUsd.times(pnl).div(100).toNumber())}
                  </Typography>
                  <Typography className={clsx(classes.metricSubValue, pnl.isPositive() ? classes.green : classes.red)}>
                    {formatNumber(pnl.toNumber()) + '%'}
                  </Typography>
                </Box>
              }
            />
          )}
        </Box>
      )}
    </Box>
  )
}

export default memo(CrabPosition)

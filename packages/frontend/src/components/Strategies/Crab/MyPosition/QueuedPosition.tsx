import React, { useState } from 'react'
import { Box, Typography, CircularProgress } from '@material-ui/core'
import { useAtom, useAtomValue } from 'jotai'

import { formatCurrency } from '@utils/formatter'
import useStyles from '@components/Strategies/Crab/useStyles'
import { BIG_ZERO, USDC_DECIMALS, CRAB_TOKEN_DECIMALS } from '@constants/index'
import { crabQueuedAtom, crabUSDValueAtom, usdcQueuedAtom, isNettingAuctionLiveAtom } from '@state/crab/atoms'
import { useDeQueueDepositUSDC, useDeQueueWithdrawCrab } from '@state/crab/hooks'
import { useTransactionStatus } from '@state/wallet/hooks'
import { toTokenAmount } from '@utils/calculations'
import { TextButton } from '@components/Button'

const DepositQueued: React.FC = () => {
  const [usdcQueued, setUsdcQueued] = useAtom(usdcQueuedAtom)
  const isNettingAuctionLive = useAtomValue(isNettingAuctionLiveAtom)
  const [usdcLoading, setUSDCLoading] = useState(false)

  const dequeueUSDC = useDeQueueDepositUSDC()
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

  const classes = useStyles()

  // ignore dust amount
  if (usdcQueued.isLessThan('100')) {
    return null
  }

  return (
    <Box display="flex" flexDirection="column" gridGap="8px">
      <Typography variant="h4" className={classes.sectionTitle}>
        Initiated Deposit
      </Typography>

      <Box display="flex" alignItems="baseline" gridGap="8px">
        <Typography className={classes.heading}>
          {formatCurrency(Number(toTokenAmount(usdcQueued, USDC_DECIMALS)))}
        </Typography>
        {!isNettingAuctionLive && (
          <TextButton color="primary" disabled={usdcLoading} onClick={onDeQueueUSDC}>
            {!usdcLoading ? 'Cancel' : <CircularProgress color="primary" size="1.5rem" />}
          </TextButton>
        )}
      </Box>
    </Box>
  )
}

const WithdrawQueued: React.FC = () => {
  const [crabQueued, setCrabQueued] = useAtom(crabQueuedAtom)
  const isNettingAuctionLive = useAtomValue(isNettingAuctionLiveAtom)
  const crabUsdValue = useAtomValue(crabUSDValueAtom)
  const [crabLoading, setCrabLoading] = useState(false)

  const dequeueCRAB = useDeQueueWithdrawCrab()
  const { resetTransactionData } = useTransactionStatus()

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

  const classes = useStyles()

  // ignore dust amount
  if (crabQueued.isLessThan('10000000000')) {
    return null
  }

  return (
    <Box display="flex" flexDirection="column" gridGap="8px">
      <Typography variant="h4" className={classes.sectionTitle}>
        Initiated Withdraw
      </Typography>

      <Box display="flex" alignItems="baseline" gridGap="8px">
        <Typography className={classes.heading}>
          {formatCurrency(
            Number(
              toTokenAmount(crabQueued, CRAB_TOKEN_DECIMALS).times(toTokenAmount(crabUsdValue, CRAB_TOKEN_DECIMALS)),
            ),
          )}
        </Typography>
        {!isNettingAuctionLive && (
          <TextButton color="primary" disabled={crabLoading} onClick={onDeQueueCrab}>
            {!crabLoading ? 'Cancel' : <CircularProgress color="primary" size="1.5rem" />}
          </TextButton>
        )}
      </Box>
    </Box>
  )
}

const QueuedPosition: React.FC = () => {
  return (
    <Box display="flex" gridGap="40px">
      <DepositQueued />
      <WithdrawQueued />
    </Box>
  )
}

export default QueuedPosition

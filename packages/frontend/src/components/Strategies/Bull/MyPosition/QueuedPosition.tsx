import React, { useState } from 'react'
import { Box, Typography, CircularProgress } from '@material-ui/core'
import { useAtom, useAtomValue } from 'jotai'
import clsx from 'clsx'

import { formatNumber } from '@utils/formatter'
import useStyles from '@components/Strategies/styles'
import { BIG_ZERO, WETH_DECIMALS, ZENBULL_TOKEN_DECIMALS } from '@constants/index'
import { ethQueuedAtom, zenBullQueuedAtom, isNettingAuctionLiveAtom, bullEthValuePerShareAtom } from '@state/bull/atoms'
import { useDequeueDepositEth, useDequeueWithdrawZenBull } from '@state/bull/hooks'
import { useTransactionStatus } from '@state/wallet/hooks'
import { toTokenAmount } from '@utils/calculations'
import { TextButton } from '@components/Button'

const DepositQueued: React.FC = () => {
  const [ethQueued, setEthQueued] = useAtom(ethQueuedAtom)
  const isNettingAuctionLive = useAtomValue(isNettingAuctionLiveAtom)
  const [txLoading, setTxLoading] = useState(false)

  const dequeueEth = useDequeueDepositEth()
  const { resetTransactionData } = useTransactionStatus()

  const onDequeueEth = async () => {
    setTxLoading(true)
    try {
      await dequeueEth(ethQueued, resetTransactionData)
      setEthQueued(BIG_ZERO)
    } catch (e) {
      console.log(e)
    }
    setTxLoading(false)
  }

  const classes = useStyles()

  return (
    <Box display="flex" flexDirection="column" gridGap="8px">
      <Typography variant="h4" className={classes.sectionTitle}>
        Initiated Deposit
      </Typography>

      <Box display="flex" alignItems="baseline" gridGap="8px">
        <Typography className={clsx(classes.heading, classes.textMonospace)}>
          {formatNumber(Number(toTokenAmount(ethQueued, WETH_DECIMALS)))} ETH
        </Typography>
        {!isNettingAuctionLive && (
          <TextButton color="primary" disabled={txLoading} onClick={onDequeueEth}>
            {!txLoading ? 'Cancel' : <CircularProgress color="primary" size="1.5rem" />}
          </TextButton>
        )}
      </Box>
    </Box>
  )
}

const WithdrawQueued: React.FC = () => {
  const [zenBullQueued, setZenBullQueued] = useAtom(zenBullQueuedAtom)
  const isNettingAuctionLive = useAtomValue(isNettingAuctionLiveAtom)
  const bullEthValue = useAtomValue(bullEthValuePerShareAtom)
  const [txLoading, setTxLoading] = useState(false)

  const dequeueZenBull = useDequeueWithdrawZenBull()
  const { resetTransactionData } = useTransactionStatus()

  const onDequeueBull = async () => {
    setTxLoading(true)
    try {
      await dequeueZenBull(zenBullQueued, resetTransactionData)
      setZenBullQueued(BIG_ZERO)
    } catch (e) {
      console.log(e)
    }
    setTxLoading(false)
  }

  const classes = useStyles()

  const withdrawalValueInEth = toTokenAmount(zenBullQueued, ZENBULL_TOKEN_DECIMALS).times(bullEthValue)

  return (
    <Box display="flex" flexDirection="column" gridGap="8px">
      <Typography variant="h4" className={classes.sectionTitle}>
        Initiated Withdraw
      </Typography>

      <Box display="flex" alignItems="baseline" gridGap="8px">
        <Typography className={clsx(classes.heading, classes.textMonospace)}>
          {formatNumber(Number(withdrawalValueInEth))} ETH
        </Typography>
        {!isNettingAuctionLive && (
          <TextButton color="primary" disabled={txLoading} onClick={onDequeueBull}>
            {!txLoading ? 'Cancel' : <CircularProgress color="primary" size="1.5rem" />}
          </TextButton>
        )}
      </Box>
    </Box>
  )
}

const QueuedPosition: React.FC = () => {
  const ethQueued = useAtomValue(ethQueuedAtom)
  const zenBullQueued = useAtomValue(zenBullQueuedAtom)

  // ignore dust amount
  // todo: come back here to see if eth's dust amount is fine
  const showQueuedDeposit = ethQueued.isGreaterThan('100')
  const showQueuedWithdraw = zenBullQueued.isGreaterThan('10000000000')

  if (!showQueuedDeposit && !showQueuedWithdraw) {
    return null
  }

  return (
    <Box display="flex" gridRowGap="40px" gridColumnGap="80px" flexWrap="wrap">
      {showQueuedDeposit && <DepositQueued />}
      {showQueuedWithdraw && <WithdrawQueued />}
    </Box>
  )
}

export default QueuedPosition

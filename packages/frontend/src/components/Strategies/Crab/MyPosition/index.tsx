import { Typography, Box, CircularProgress } from '@material-ui/core'
import React, { memo } from 'react'
import { useAtomValue } from 'jotai'

import { addressAtom } from '@state/wallet/atoms'
import useAppMemo from '@hooks/useAppMemo'
import { useCrabPositionV2 } from '@hooks/useCrabPosition/useCrabPosition'
import { pnlInPerctv2 } from 'src/lib/pnl'
import { crabQueuedInUsdAtom, crabQueuedAtom, usdcQueuedAtom } from '@state/crab/atoms'
import useStyles from '@components/Strategies/styles'
import { BIG_ZERO } from '@constants/index'
import CrabPosition from './CrabPosition'
import QueuedPosition from './QueuedPosition'
import BigNumber from 'bignumber.js'

const MyPosition: React.FC<{ currentCrabPositionValue: BigNumber; isCrabPositionValueLoading: boolean }> = ({
  currentCrabPositionValue,
  isCrabPositionValueLoading,
}) => {
  const usdcQueued = useAtomValue(usdcQueuedAtom)
  const crabQueued = useAtomValue(crabQueuedAtom)
  const address = useAtomValue(addressAtom)
  const { loading: isCrabPositionLoading, depositedUsd, firstDepositTimestamp } = useCrabPositionV2(address || '')

  const crabV2QueuedInUsd = useAtomValue(crabQueuedInUsdAtom)

  const pnl = useAppMemo(() => {
    console.log(currentCrabPositionValue.toString(), depositedUsd.toString(), 'Position value')
    return pnlInPerctv2(currentCrabPositionValue.plus(crabV2QueuedInUsd), depositedUsd)
  }, [currentCrabPositionValue, depositedUsd, crabV2QueuedInUsd])

  const loading = useAppMemo(() => {
    return isCrabPositionLoading || isCrabPositionValueLoading
  }, [isCrabPositionLoading, isCrabPositionValueLoading])

  const classes = useStyles()

  const currentPositionValue = currentCrabPositionValue.isGreaterThan(0) ? currentCrabPositionValue : BIG_ZERO
  if (currentPositionValue.isZero() && usdcQueued.isZero() && crabQueued.isZero()) {
    return null
  }

  if (loading) {
    return (
      <Box display="flex" alignItems="flex-start" marginTop="8px" height="72px">
        <Box display="flex" alignItems="center" gridGap="20px">
          <CircularProgress size="1.25rem" className={classes.loadingSpinner} />
          <Typography className={classes.text}>Fetching current position...</Typography>
        </Box>
      </Box>
    )
  }

  return (
    <Box display="flex" flexDirection="column" gridGap="40px">
      <CrabPosition
        depositedUsd={depositedUsd}
        currentPosition={currentPositionValue}
        pnl={pnl}
        firstDepositTimestamp={firstDepositTimestamp}
      />
      <QueuedPosition />
    </Box>
  )
}

export default memo(MyPosition)

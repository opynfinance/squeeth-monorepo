import { Typography, Box, CircularProgress } from '@material-ui/core'
import React, { memo } from 'react'
import { useAtomValue } from 'jotai'

import { addressAtom } from '@state/wallet/atoms'
import { useCurrentCrabPositionValueV2 } from '@state/crab/hooks'
import useAppMemo from '@hooks/useAppMemo'
import { useCrabPositionV2 } from '@hooks/useCrabPosition/useCrabPosition'
import { pnlInPerctv2 } from 'src/lib/pnl'
import { crabQueuedInUsdAtom } from '@state/crab/atoms'
import useStyles from '@components/Strategies/Crab/useStyles'
import CrabPosition from './CrabPosition'
import QueuedPosition from './QueuedPosition'

const MyPosition: React.FC = () => {
  const address = useAtomValue(addressAtom)
  const { loading: isCrabPositionLoading, depositedUsd } = useCrabPositionV2(address || '')
  const { currentCrabPositionValue, isCrabPositionValueLoading } = useCurrentCrabPositionValueV2()

  const crabV2QueuedInUsd = useAtomValue(crabQueuedInUsdAtom)

  const pnl = useAppMemo(() => {
    console.log(currentCrabPositionValue.toString(), depositedUsd.toString(), 'Position value')
    return pnlInPerctv2(currentCrabPositionValue.plus(crabV2QueuedInUsd), depositedUsd)
  }, [currentCrabPositionValue, depositedUsd, crabV2QueuedInUsd])

  const loading = useAppMemo(() => {
    return isCrabPositionLoading || isCrabPositionValueLoading
  }, [isCrabPositionLoading, isCrabPositionValueLoading])

  const classes = useStyles()

  if (loading) {
    return (
      <Box display="flex" alignItems="flex-start" marginTop="8px" height="98px">
        <Box display="flex" alignItems="center" gridGap="20px">
          <CircularProgress size="1.25rem" className={classes.loadingSpinner} />
          <Typography className={classes.text}>Fetching current position...</Typography>
        </Box>
      </Box>
    )
  }

  return (
    <Box display="flex" flexDirection="column" gridGap="40px">
      <CrabPosition depositedUsd={depositedUsd} currentPosition={currentCrabPositionValue} pnl={pnl} />
      <QueuedPosition />
    </Box>
  )
}

export default memo(MyPosition)

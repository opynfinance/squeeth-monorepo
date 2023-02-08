import { Typography, Box } from '@material-ui/core'
import React, { memo } from 'react'
import { useAtomValue } from 'jotai'
import { Skeleton } from '@material-ui/lab'

import {
  bullCurrentETHPositionAtom,
  bullPositionLoadedAtom,
  isBullPositionRefetchingAtom,
  ethQueuedAtom,
  zenBullQueuedAtom,
  bullEthPnlAtom,
} from '@state/bull/atoms'

import useStyles from '@components/Strategies/styles'
import ZenBullPosition from './ZenBullPosition'
import QueuedPosition from './QueuedPosition'

const BullPosition: React.FC = () => {
  const bullPosition = useAtomValue(bullCurrentETHPositionAtom)
  const ethQueued = useAtomValue(ethQueuedAtom)
  const zenBullQueued = useAtomValue(zenBullQueuedAtom)
  const bullEthPnL = useAtomValue(bullEthPnlAtom)

  const classes = useStyles()

  const loading = !useAtomValue(bullPositionLoadedAtom)
  const isPositionRefetching = useAtomValue(isBullPositionRefetchingAtom)
  const isPnlLoading = !bullEthPnL.isFinite()

  if (bullPosition.isZero() && !isPositionRefetching && ethQueued.isZero() && zenBullQueued.isZero()) {
    return null
  }

  if (loading || isPositionRefetching || isPnlLoading) {
    return (
      <Box display="flex" flexDirection="column" gridGap="12px">
        <Typography variant="h4" className={classes.sectionTitle}>
          My Zen Bull Position
        </Typography>
        <Skeleton width={'100%'} height={'80px'} style={{ transform: 'none' }} />
      </Box>
    )
  }

  return (
    <Box display="flex" flexDirection="column" gridGap="40px">
      <ZenBullPosition />
      <QueuedPosition />
    </Box>
  )
}

export default memo(BullPosition)

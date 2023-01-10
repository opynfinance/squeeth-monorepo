import { Typography, Box, CircularProgress } from '@material-ui/core'
import React, { memo } from 'react'
import clsx from 'clsx'
import { useAtomValue } from 'jotai'
import { makeStyles, createStyles } from '@material-ui/core/styles'

import {
  bullCurrentETHPositionAtom,
  bullCurrentUSDCPositionAtom,
  bullEthPnlAtom,
  bullEthPnlPerctAtom,
  bullPositionLoadedAtom,
  isBullPositionRefetchingAtom,
} from '@state/bull/atoms'
import { formatCurrency, formatNumber } from '@utils/formatter'
import useStyles from '@components/Strategies/styles'
import PnL from './PnL'

const BullPosition: React.FC = () => {
  const bullPosition = useAtomValue(bullCurrentETHPositionAtom)
  const bullUsdcPosition = useAtomValue(bullCurrentUSDCPositionAtom)
  const classes = useStyles()

  const loading = !useAtomValue(bullPositionLoadedAtom)
  const isPositionRefetching = useAtomValue(isBullPositionRefetchingAtom)

  if (bullPosition.isZero() && !isPositionRefetching) {
    return null
  }

  if (loading || isPositionRefetching) {
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
    <Box display="flex" flexDirection="column" gridGap="6px">
      <Typography variant="h4" className={classes.sectionTitle}>
        My Zen Bull Position
      </Typography>

      <Box display="flex" gridGap="12px" alignItems="baseline">
        <Typography className={clsx(classes.heading, classes.textMonospace)}>
          {formatNumber(bullPosition.toNumber(), 4) + ' ETH'}
        </Typography>
        <Typography className={clsx(classes.description, classes.textMonospace)}>
          {formatCurrency(bullUsdcPosition.toNumber())}
        </Typography>
      </Box>

      <PnL />
    </Box>
  )
}

export default memo(BullPosition)

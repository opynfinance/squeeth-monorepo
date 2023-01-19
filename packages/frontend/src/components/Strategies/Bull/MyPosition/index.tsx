import { Typography, Box, CircularProgress } from '@material-ui/core'
import React, { memo } from 'react'
import clsx from 'clsx'
import { useAtomValue } from 'jotai'

import {
  bullCurrentETHPositionAtom,
  bullCurrentUSDCPositionAtom,
  bullEthPnlAtom,
  bullEthPnlPerctAtom,
  bullPositionLoadedAtom,
  isBullPositionRefetchingAtom,
  bullFirstDepositTimestampAtom,
} from '@state/bull/atoms'
import { formatCurrency, formatNumber } from '@utils/formatter'
import SharePnl from '@components/Strategies/SharePnl'
import PnL from './PnL'
import useStyles from '@components/Strategies/styles'

const BullPosition: React.FC = () => {
  const bullPosition = useAtomValue(bullCurrentETHPositionAtom)
  const bullUsdcPosition = useAtomValue(bullCurrentUSDCPositionAtom)
  const bullEthPnL = useAtomValue(bullEthPnlAtom)
  const bullEthPnlPerct = useAtomValue(bullEthPnlPerctAtom)
  const firstDepositTimestamp = useAtomValue(bullFirstDepositTimestampAtom)

  const classes = useStyles()

  const loading = !useAtomValue(bullPositionLoadedAtom)
  const isPositionRefetching = useAtomValue(isBullPositionRefetchingAtom)

  if (bullPosition.isZero() && !isPositionRefetching) {
    return null
  }

  if (loading || isPositionRefetching) {
    return (
      <Box display="flex" alignItems="flex-start" marginTop="8px" height="72px">
        <Box display="flex" alignItems="center" gridGap="20px">
          <CircularProgress size="1.25rem" className={classes.loadingSpinner} />
          <Typography className={classes.text}>Fetching current position...</Typography>
        </Box>
      </Box>
    )
  }

  const isPnlLoading = !bullEthPnL.isFinite()

  return (
    <Box display="flex" flexDirection="column" gridGap="12px">
      <div>
        <Typography variant="h4" className={classes.sectionTitle}>
          My Zen Bull Position
        </Typography>

        <Box display="flex" alignItems="baseline" gridColumnGap="12px" gridRowGap="2px" flexWrap="wrap" marginTop="6px">
          <Typography className={clsx(classes.heading, classes.textMonospace)}>
            {formatNumber(bullPosition.toNumber(), 4) + ' ETH'}
          </Typography>

          <Typography className={clsx(classes.description, classes.textMonospace)}>
            {formatCurrency(bullUsdcPosition.toNumber())}
          </Typography>

          <PnL isPnlLoading={isPnlLoading} bullEthPnl={bullEthPnL} bullEthPnlPercent={bullEthPnlPerct} />
        </Box>
      </div>

      {/* <SharePnl
        isPnlLoading={isPnlLoading}
        strategy="zenbull"
        pnl={bullEthPnlPerct.toNumber()}
        firstDepositTimestamp={firstDepositTimestamp}
      /> */}
    </Box>
  )
}

export default memo(BullPosition)

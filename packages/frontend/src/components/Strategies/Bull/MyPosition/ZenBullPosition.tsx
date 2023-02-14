import React from 'react'
import { Box, Typography } from '@material-ui/core'
import clsx from 'clsx'
import { useAtomValue } from 'jotai'

import useStyles from '@components/Strategies/styles'
import { formatNumber, formatCurrency } from '@utils/formatter'
import SharePnl from '@components/Strategies/SharePnl'
import {
  bullCurrentETHPositionAtom,
  bullCurrentUSDCPositionAtom,
  bullEthPnlAtom,
  bullEthPnlPerctAtom,
  bullFirstDepositTimestampAtom,
} from '@state/bull/atoms'
import PnL from './PnL'

const ZenBullPosition: React.FC = () => {
  const classes = useStyles()

  const bullPosition = useAtomValue(bullCurrentETHPositionAtom)
  const bullUsdcPosition = useAtomValue(bullCurrentUSDCPositionAtom)
  const bullEthPnL = useAtomValue(bullEthPnlAtom)
  const bullEthPnlPerct = useAtomValue(bullEthPnlPerctAtom)
  const firstDepositTimestamp = useAtomValue(bullFirstDepositTimestampAtom)

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

      <SharePnl
        isPnlLoading={isPnlLoading}
        strategy="zenbull"
        pnl={bullEthPnlPerct.toNumber()}
        firstDepositTimestamp={firstDepositTimestamp}
      />
    </Box>
  )
}

export default ZenBullPosition

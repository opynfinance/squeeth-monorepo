import React from 'react'
import { Box, Typography } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import clsx from 'clsx'

import { formatCurrency, formatNumber } from '@utils/formatter'
import useStyles from '@components/Strategies/styles'
import SharePnL from '@components/Strategies/SharePnL'
import PnL from './PnL'

interface CrabPositionProps {
  depositedUsd: BigNumber
  currentPosition: BigNumber
  pnl: BigNumber
}

const CrabPosition: React.FC<CrabPositionProps> = ({ depositedUsd, currentPosition, pnl }) => {
  const classes = useStyles()

  const pnlPercent = pnl.toNumber()
  const pnlFormatted = formatNumber(pnlPercent)
  const pnlText = pnlPercent > 0 ? `+${pnlFormatted}%` : `${pnlFormatted}%`

  const sharePnLText = `I'm earning ${pnlText} USDC with the Opyn Crab Strategy`
  const sharePnLUrl = 'squeeth.com/strategies'

  const isPnlLoading = !pnl.isFinite()

  return (
    <Box display="flex" flexDirection="column" gridGap="12px">
      <div>
        <Typography variant="h4" className={classes.sectionTitle}>
          My Crab Position
        </Typography>

        <Box display="flex" alignItems="baseline" gridColumnGap="12px" gridRowGap="2px" flexWrap="wrap" marginTop="6px">
          <Typography className={clsx(classes.heading, classes.textMonospace)}>
            {formatCurrency(currentPosition.toNumber())}
          </Typography>

          <PnL isPnlLoading={isPnlLoading} depositedUsd={depositedUsd} pnl={pnl} />
        </Box>
      </div>

      <SharePnL isPnlLoading={isPnlLoading} text={sharePnLText} url={sharePnLUrl} />
    </Box>
  )
}

export default CrabPosition

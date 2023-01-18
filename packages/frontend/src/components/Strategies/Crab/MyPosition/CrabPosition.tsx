import React from 'react'
import { Box, Typography } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import clsx from 'clsx'

import { formatCurrency, formatNumber } from '@utils/formatter'
import useStyles from '@components/Strategies/styles'
import SharePnl from '@components/Strategies/SharePnl'
import { SQUEETH_BASE_URL } from '@constants/index'
import PnL from './PnL'

interface CrabPositionProps {
  depositedUsd: BigNumber
  currentPosition: BigNumber
  pnl: BigNumber
  firstDepositTimestamp: number
}

const CrabPosition: React.FC<CrabPositionProps> = ({ depositedUsd, currentPosition, pnl, firstDepositTimestamp }) => {
  const classes = useStyles()

  const pnlPercent = pnl.toNumber()
  const pnlFormatted = formatNumber(pnlPercent)
  const pnlText = pnlPercent > 0 ? `+${pnlFormatted}%` : `${pnlFormatted}%`

  const sharePnlText = `I'm earning ${pnlText} USDC with the Opyn Crab Strategy`
  const sharePnlPageUrl = `${SQUEETH_BASE_URL}/share-pnl?strategy=crab&pnl=${pnlFormatted}&depositedAt=${firstDepositTimestamp}`

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

      <SharePnl isPnlLoading={isPnlLoading} strategyName="crab" text={sharePnlText} sharePnlPageUrl={sharePnlPageUrl} />
    </Box>
  )
}

export default CrabPosition

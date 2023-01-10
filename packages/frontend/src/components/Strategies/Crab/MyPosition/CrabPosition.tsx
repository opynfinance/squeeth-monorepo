import React from 'react'
import { Box, Typography, CircularProgress } from '@material-ui/core'
import ArrowDropUpIcon from '@material-ui/icons/ArrowDropUp'
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown'
import BigNumber from 'bignumber.js'
import clsx from 'clsx'

import { formatCurrency, formatNumber } from '@utils/formatter'
import useStyles from '@components/Strategies/styles'
import PnL from './PnL'

interface CrabPositionProps {
  depositedUsd: BigNumber
  currentPosition: BigNumber
  pnl: BigNumber
}

const CrabPosition: React.FC<CrabPositionProps> = ({ depositedUsd, currentPosition, pnl }) => {
  const classes = useStyles()

  return (
    <Box display="flex" flexDirection="column" gridGap="6px">
      <Typography variant="h4" className={classes.sectionTitle}>
        My Crab Position
      </Typography>

      <Typography className={clsx(classes.heading, classes.textMonospace)}>
        {formatCurrency(currentPosition.toNumber())}
      </Typography>

      <PnL depositedUsd={depositedUsd} pnl={pnl} />
    </Box>
  )
}

export default CrabPosition

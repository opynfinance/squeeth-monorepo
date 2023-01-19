import { Typography, Box, CircularProgress } from '@material-ui/core'
import React from 'react'
import clsx from 'clsx'
import ArrowDropUpIcon from '@material-ui/icons/ArrowDropUp'
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown'
import BigNumber from 'bignumber.js'

import useStyles from '@components/Strategies/styles'
import { formatNumber } from '@utils/formatter'

interface PnLProps {
  isPnlLoading: Boolean
  bullEthPnl: BigNumber
  bullEthPnlPercent: BigNumber
}

const PnL: React.FC<PnLProps> = ({ isPnlLoading, bullEthPnl, bullEthPnlPercent }) => {
  const classes = useStyles()

  if (isPnlLoading) {
    return (
      <Box display="flex" alignItems="center" gridGap="8px">
        <CircularProgress size="1rem" className={classes.loadingSpinner} />
        <Typography className={classes.text}>fetching pnl...</Typography>
      </Box>
    )
  }

  const isPnlPositive = bullEthPnl.isGreaterThanOrEqualTo(0)
  const textClassName = clsx(
    classes.description,
    classes.textSemibold,
    classes.textMonospace,
    isPnlPositive ? classes.colorSuccess : classes.colorError,
  )

  return (
    <Box display="flex" gridGap="8px" flexWrap="wrap" position="relative" top="2px">
      <Box display="flex" gridGap="8px">
        <Box display="flex" marginLeft="-6px">
          {isPnlPositive ? (
            <ArrowDropUpIcon fontSize="small" className={classes.colorSuccess} />
          ) : (
            <ArrowDropDownIcon fontSize="small" className={classes.colorError} />
          )}
          <Typography className={textClassName}>{formatNumber(bullEthPnlPercent.toNumber()) + '%'}</Typography>
        </Box>

        <Typography className={textClassName}>
          ({isPnlPositive && '+'}
          {formatNumber(bullEthPnl.toNumber(), 4) + ' ETH'})
        </Typography>
      </Box>
      <Typography className={classes.description}>since deposit</Typography>
    </Box>
  )
}

export default PnL

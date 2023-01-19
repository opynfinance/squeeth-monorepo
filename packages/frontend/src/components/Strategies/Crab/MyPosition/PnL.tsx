import { Typography, Box, CircularProgress } from '@material-ui/core'
import React, { memo } from 'react'
import clsx from 'clsx'
import ArrowDropUpIcon from '@material-ui/icons/ArrowDropUp'
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown'
import BigNumber from 'bignumber.js'

import useStyles from '@components/Strategies/styles'
import { formatNumber, formatCurrency } from '@utils/formatter'

interface PnLProps {
  isPnlLoading: Boolean
  depositedUsd: BigNumber
  pnl: BigNumber
}

const PnL: React.FC<PnLProps> = ({ isPnlLoading, depositedUsd, pnl }) => {
  const classes = useStyles()

  if (isPnlLoading) {
    return (
      <Box display="flex" alignItems="center" gridGap="8px">
        <CircularProgress size="1rem" className={classes.loadingSpinner} />
        <Typography className={classes.text}>fetching pnl...</Typography>
      </Box>
    )
  }

  const isPnlPositive = pnl.isGreaterThanOrEqualTo(0)
  const textClassName = clsx(
    classes.description,
    classes.textSemibold,
    classes.textMonospace,
    isPnlPositive ? classes.colorSuccess : classes.colorError,
  )

  return (
    <Box display="flex" flexDirection="column" gridGap="12px" position="relative" top="2px">
      <Box display="flex" gridGap="8px">
        <Box display="flex" marginLeft="-6px">
          <div>
            {isPnlPositive ? (
              <ArrowDropUpIcon fontSize="small" className={classes.colorSuccess} />
            ) : (
              <ArrowDropDownIcon fontSize="small" className={classes.colorError} />
            )}
          </div>

          <Typography className={textClassName}>{formatNumber(pnl.toNumber()) + '%'}</Typography>
        </Box>

        <Typography className={textClassName}>
          ({isPnlPositive && '+'}
          {formatCurrency(depositedUsd.times(pnl).div(100).toNumber())})
        </Typography>
        <Typography className={classes.description}>since deposit</Typography>
      </Box>
    </Box>
  )
}

export default PnL

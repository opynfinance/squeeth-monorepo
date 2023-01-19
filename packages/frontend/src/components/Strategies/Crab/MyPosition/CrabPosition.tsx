import React from 'react'
import { Box, Typography, CircularProgress } from '@material-ui/core'
import ArrowDropUpIcon from '@material-ui/icons/ArrowDropUp'
import ArrowDropDownIcon from '@material-ui/icons/ArrowDropDown'
import BigNumber from 'bignumber.js'
import clsx from 'clsx'

import { formatCurrency, formatNumber } from '@utils/formatter'
import useStyles from '@components/Strategies/styles'

interface CrabPositionProps {
  depositedUsd: BigNumber
  currentPosition: BigNumber
  pnl: BigNumber
}

const CrabPosition: React.FC<CrabPositionProps> = ({ depositedUsd, currentPosition, pnl }) => {
  const classes = useStyles()

  const isPnlPositive = pnl.isGreaterThanOrEqualTo(0)

  return (
    <Box display="flex" flexDirection="column" gridGap="8px">
      <Typography variant="h4" className={classes.sectionTitle}>
        My Crab Position
      </Typography>

      <Typography className={clsx(classes.heading, classes.textMonospace)}>
        {formatCurrency(currentPosition.toNumber())}
      </Typography>

      <Box display="flex" alignItems="center" gridGap="8px">
        {pnl.isFinite() ? (
          <>
            <Box display="flex" marginLeft="-6px">
              {isPnlPositive ? (
                <ArrowDropUpIcon className={classes.colorSuccess} />
              ) : (
                <ArrowDropDownIcon className={classes.colorError} />
              )}

              <Typography
                className={clsx(
                  classes.description,
                  classes.textSemibold,
                  classes.textMonospace,
                  isPnlPositive ? classes.colorSuccess : classes.colorError,
                )}
              >
                {formatNumber(pnl.toNumber()) + '%'}
              </Typography>
            </Box>

            <Typography
              className={clsx(
                classes.description,
                classes.textSemibold,
                classes.textMonospace,
                isPnlPositive ? classes.colorSuccess : classes.colorError,
              )}
            >
              ({isPnlPositive && '+'}
              {formatCurrency(depositedUsd.times(pnl).div(100).toNumber())})
            </Typography>
            <Typography className={classes.description}>since deposit</Typography>
          </>
        ) : (
          <Box display="flex" alignItems="center" gridGap="12px">
            <CircularProgress size="1rem" className={classes.loadingSpinner} />
            <Typography className={classes.text}>fetching pnl...</Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default CrabPosition

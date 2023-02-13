import React from 'react'
import { Box, Typography } from '@material-ui/core'
import clsx from 'clsx'

import useStyles from './styles'
import { formatNumber } from '@utils/formatter'

const PerformanceMetric: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const classes = useStyles()

  return (
    <Box display="flex" justifyContent="flex-end" alignItems="center" gridGap="6px">
      <Typography variant="h4" className={classes.textSmall}>
        {label}
      </Typography>

      <Box minWidth="6ch" display="flex" justifyContent="flex-end">
        <Typography
          className={clsx(
            classes.textSmall,
            classes.textMonospace,
            value >= 0 ? classes.colorSuccess : classes.colorError,
          )}
        >
          {value >= 0 && '+'}
          {formatNumber(value)}%
        </Typography>
      </Box>
    </Box>
  )
}

export default PerformanceMetric

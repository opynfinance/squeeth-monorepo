import { Typography, Box } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import BigNumber from 'bignumber.js'
import React from 'react'
import clsx from 'clsx'

import { CustomLinearProgressNew } from '@components/CustomProgress'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      width: '100%',
    },
    label: {
      fontSize: '14px',
      fontWeight: 400,
    },
    value: {
      fontFamily: 'DM Mono',
    },
    green: {
      color: theme.palette.success.main,
    },
  }),
)

type CapType = {
  maxCap: BigNumber
  depositedAmount: BigNumber
}

const CapDetails: React.FC<CapType> = ({ maxCap, depositedAmount }) => {
  const classes = useStyles()

  return (
    <div className={classes.container}>
      <Box display="flex" justifyContent="space-between" alignItems="center" marginBottom="8px">
        <Typography className={clsx(classes.label, classes.value, classes.green)}>
          {depositedAmount.gt(maxCap)
            ? Number(maxCap.toFixed(4)).toLocaleString()
            : Number(depositedAmount.toFixed(4)).toLocaleString()}{' '}
          ETH
        </Typography>

        <Typography className={clsx(classes.label, classes.value)}>
          {Number(maxCap.toFixed(4)).toLocaleString()} ETH
        </Typography>
      </Box>
      <div>
        <CustomLinearProgressNew
          variant="determinate"
          value={
            depositedAmount.gt(maxCap)
              ? maxCap.div(maxCap).times(100).toNumber()
              : depositedAmount.div(maxCap).times(100).toNumber()
          }
        />
        <Box display="flex" justifyContent="space-between" alignItems="center" marginTop="8px">
          <Typography className={clsx(classes.label, classes.green)}>Deposits</Typography>
          <Typography className={classes.label}>Cap</Typography>
        </Box>
      </div>
    </div>
  )
}

export default CapDetails

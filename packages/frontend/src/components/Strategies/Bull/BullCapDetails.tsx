import { Typography, Box } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import BigNumber from 'bignumber.js'
import React from 'react'
import clsx from 'clsx'

import { CustomLinearProgressNew } from '@components/CustomProgress'
import { useAtomValue } from 'jotai'
import { bullCapAtom, bullDepositedEthInEulerAtom } from '@state/bull/atoms'

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

const BullCapDetails: React.FC = () => {
  const classes = useStyles()

  const depositedAmount = useAtomValue(bullDepositedEthInEulerAtom)
  const maxCap = useAtomValue(bullCapAtom)

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

export default BullCapDetails

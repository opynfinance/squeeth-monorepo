import CustomLinearProgress from '@components/CustomProgress'
import { Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import BigNumber from 'bignumber.js'
import React from 'react'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(2, 5),
      background: theme.palette.background.stone,
      borderRadius: theme.spacing(2),
      width: '100%',
    },
    vaultDetails: {
      display: 'flex',
      justifyContent: 'space-between',
    },
    vaultProgress: {
      marginTop: theme.spacing(2),
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
      <div className={classes.vaultDetails}>
        <div>
          <Typography variant="body2" color="textSecondary">
            Strategy Deposits
          </Typography>
          <Typography variant="h6">
            {depositedAmount.gt(maxCap)
              ? Number(maxCap.toFixed(4)).toLocaleString()
              : Number(depositedAmount.toFixed(4)).toLocaleString()}{' '}
            ETH
          </Typography>
        </div>
        <div>
          <Typography variant="body2" color="textSecondary">
            Strategy Capacity
          </Typography>
          <Typography variant="h6">{Number(maxCap.toFixed(4)).toLocaleString()} ETH</Typography>
        </div>
      </div>
      <div className={classes.vaultProgress}>
        <CustomLinearProgress
          variant="determinate"
          value={
            depositedAmount.gt(maxCap)
              ? maxCap.div(maxCap).times(100).toNumber()
              : depositedAmount.div(maxCap).times(100).toNumber()
          }
        />
      </div>
    </div>
  )
}

export default CapDetails

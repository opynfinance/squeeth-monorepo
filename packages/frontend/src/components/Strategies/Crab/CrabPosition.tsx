import { useCrabPosition } from '@hooks/useCrabPosition'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import BigNumber from 'bignumber.js'
import React, { useEffect, useState } from 'react'
import { Typography } from '@material-ui/core'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(1),
      backgroundColor: theme.palette.background.lightStone,
      borderRadius: theme.spacing(1),
    },
    green: {
      color: theme.palette.success.main,
    },
    red: {
      color: theme.palette.error.main,
    },
  }),
)

const CrabPosition: React.FC<{ user: string | null }> = ({ user }) => {
  if (!user) return <UserNotConnected />

  return <PositionCard user={user} />
}

const UserNotConnected: React.FC = () => {
  const classes = useStyles()
  return <div className={classes.container}>Connect Wallet</div>
}

const PositionCard: React.FC<{ user: string }> = ({ user }) => {
  const classes = useStyles()
  const { minCurrentEth, minPnL } = useCrabPosition(user)

  return (
    <div className={classes.container}>
      <Typography color="primary" variant="subtitle1">
        Position
      </Typography>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="h6">{minCurrentEth.toFixed(6)} ETH</Typography>
        <Typography
          variant="body2"
          style={{ marginLeft: '4px', fontWeight: 600 }}
          className={minPnL.isNegative() ? classes.red : classes.green}
        >
          ({minPnL.toFixed(2)} %)
        </Typography>
      </div>
    </div>
  )
}

export default CrabPosition

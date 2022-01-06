import { Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React from 'react'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      display: 'flex',
      flexDirection: 'column',
      background: theme.palette.background.stone,
      borderRadius: theme.spacing(2),
      padding: theme.spacing(2, 3),
      width: '200px',
    },
    overviewTitle: {
      fontSize: '14px',
      color: theme.palette.text.secondary,
      fontWeight: 600,
    },
    overviewValue: {
      fontSize: '22px',
    },
  }),
)

type StrategyProps = {
  value?: string
  label: string
}

const StrategyInfoItem: React.FC<StrategyProps> = ({ value, label }) => {
  const classes = useStyles()

  return (
    <div className={classes.container}>
      <Typography className={classes.overviewValue}>{value}</Typography>
      <Typography className={classes.overviewTitle}>{label}</Typography>
    </div>
  )
}

export default StrategyInfoItem

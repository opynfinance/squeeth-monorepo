import { createStyles, makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import React from 'react'

const useStyles = makeStyles((theme) =>
  createStyles({
    txItem: {
      display: 'flex',
      marginTop: theme.spacing(1),
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    txLabel: {
      fontSize: '14px',
      color: theme.palette.text.secondary,
    },
    txUnit: {
      fontSize: '12px',
      color: theme.palette.text.secondary,
      marginLeft: theme.spacing(1),
    },
  }),
)

const TradeInfoItem: React.FC<{ value?: string | number; unit: string; label: string }> = ({ value, unit, label }) => {
  const classes = useStyles()

  return (
    <div className={classes.txItem}>
      <Typography className={classes.txLabel}>{label}</Typography>
      <div>
        <Typography component="span">{value}</Typography>
        <Typography component="span" variant="caption" className={classes.txUnit}>
          {unit}
        </Typography>
      </div>
    </div>
  )
}

export default TradeInfoItem

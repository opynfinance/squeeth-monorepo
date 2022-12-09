import { createStyles, makeStyles, Typography } from '@material-ui/core'
import React, { ReactNode } from 'react'
import clsx from 'clsx'

type TradeDetailsType = {
  actionTitle: string
  amount: string
  unit: string
  value: string
  id?: string
  hint: ReactNode
}
const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      borderRadius: theme.spacing(1),
      padding: theme.spacing(1.5),
      width: '300px',
      marginLeft: 'auto',
      marginRight: 'auto',
      marginTop: theme.spacing(2),
      backgroundColor: theme.palette.background.stone,
      textAlign: 'left',
    },
    squeethExp: {
      display: 'flex',
      justifyContent: 'space-between',
      textAlign: 'left',
    },
    squeethExpTxt: {
      fontSize: '20px',
    },
  }),
)

const TradeDetails: React.FC<TradeDetailsType> = ({ actionTitle, amount, id, unit, value, hint }) => {
  const classes = useStyles()

  return (
    <div className={classes.container} id={id}>
      <div className={classes.squeethExp}>
        <div>
          <Typography variant="caption">{actionTitle}</Typography>
          <Typography className={classes.squeethExpTxt}>{amount}</Typography>
        </div>
        <div>
          <Typography variant="caption">${value}</Typography>
          <Typography className={clsx(classes.squeethExpTxt, 'trade-details-amount')}>{amount}</Typography>
        </div>
      </div>
      <Typography variant="caption" color="textSecondary">
        {hint}
      </Typography>
    </div>
  )
}

export default TradeDetails

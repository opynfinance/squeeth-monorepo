import { Tooltip } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import InfoIcon from '@material-ui/icons/InfoOutlined'
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
      fontSize: '.9rem',
      color: theme.palette.text.secondary,
      display: 'flex',
      alignItems: 'center',
    },
    txUnit: {
      fontSize: '12px',
      color: theme.palette.text.secondary,
      marginLeft: theme.spacing(1),
    },
    txLabelDiv: {
      display: 'flex',
      alignItems: 'center',
    },
    infoIcon: {
      fontSize: '1rem',
      marginLeft: theme.spacing(0.5),
      marginTop: '2px',
    },
  }),
)

const TradeInfoItem: React.FC<{ value?: string | number; unit: string; label: string; tooltip?: string }> = ({
  value,
  unit,
  label,
  tooltip,
}) => {
  const classes = useStyles()

  return (
    <div className={classes.txItem}>
      <Typography variant="body1" className={classes.txLabel}>
        {label}
        {tooltip ? (
          <Tooltip title={tooltip}>
            <InfoIcon className={classes.infoIcon} />
          </Tooltip>
        ) : null}
      </Typography>
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

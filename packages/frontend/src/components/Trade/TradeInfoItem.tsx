import { Tooltip } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import AccessTimeIcon from '@material-ui/icons/AccessTime'
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import React, { useMemo } from 'react'

const useStyles = makeStyles((theme) =>
  createStyles({
    txItem: {
      display: 'flex',
      // marginTop: theme.spacing(1),
      justifyContent: 'space-between',
      alignItems: 'center',
      width: '100%',
      marginRight: 'auto',
      marginLeft: 'auto',
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
    red: {
      color: theme.palette.error.main,
    },
    green: {
      color: theme.palette.success.main,
    },
    primary: {
      color: theme.palette.primary.main,
    },
  }),
)

type tradeType = {
  value?: string | number
  unit?: string
  frontUnit?: string
  label: string
  tooltip?: React.ReactNode
  color?: 'primary' | 'red' | 'green'
  priceType?: string
}

const TradeInfoItem: React.FC<tradeType> = ({ value, unit, frontUnit, label, tooltip, color, priceType }) => {
  const classes = useStyles()
  const clrClass = useMemo(() => {
    if (color === 'primary') return classes.primary
    if (color === 'green') return classes.green
    if (color === 'red') return classes.red
    return ''
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color])

  return (
    <div className={classes.txItem}>
      <Typography variant="body1" className={classes.txLabel}>
        {label}
        {tooltip ? (
          <Tooltip title={tooltip}>
            {priceType === 'twap' ? (
              <AccessTimeIcon className={classes.infoIcon} />
            ) : priceType === 'spot' ? (
              <FiberManualRecordIcon className={classes.infoIcon} />
            ) : (
              <InfoIcon className={classes.infoIcon} />
            )}
          </Tooltip>
        ) : null}
      </Typography>
      <div>
        <Typography component="span" variant="caption" className={classes.txUnit}>
          {frontUnit}
        </Typography>
        <Typography component="span" style={{ marginLeft: '8px', fontSize: '.9rem' }} className={clrClass}>
          {value}
        </Typography>
        <Typography component="span" variant="caption" className={classes.txUnit}>
          {unit}
        </Typography>
      </div>
    </div>
  )
}

export default TradeInfoItem

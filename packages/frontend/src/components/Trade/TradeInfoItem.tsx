import { Tooltip, useTheme } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import Typography from '@material-ui/core/Typography'
import AccessTimeIcon from '@material-ui/icons/AccessTime'
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import React, { useMemo } from 'react'
import clsx from 'clsx'

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
  id?: string
  tooltip?: React.ReactNode
  color?: 'primary' | 'red' | 'green' | string
  priceType?: string
}

const TradeInfoItem: React.FC<tradeType> = ({ value, unit, id, frontUnit, label, tooltip, color, priceType }) => {
  const classes = useStyles()
  const theme = useTheme()

  const colorCode = useMemo(() => {
    if (color === 'primary') return theme.palette.primary.main
    if (color === 'green') return theme.palette.success.main
    if (color === 'red') return theme.palette.error.main
    return color
  }, [color, theme.palette.error.main, theme.palette.primary.main, theme.palette.success.main])

  return (
    <div className={classes.txItem} id={id}>
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
        <Typography
          component="span"
          style={{ marginLeft: '8px', fontSize: '.9rem', color: colorCode }}
          className={'trade-info-item-value'}
        >
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

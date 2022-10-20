import { Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React from 'react'
import AccessTimeIcon from '@material-ui/icons/AccessTime'
import FiberManualRecordIcon from '@material-ui/icons/FiberManualRecord'
import { Tooltip } from '@material-ui/core'
import InfoIcon from '@material-ui/icons/InfoOutlined'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      display: 'flex',
      flexDirection: 'column',
      background: theme.palette.background.stone,
      borderRadius: theme.spacing(2),
      padding: theme.spacing(2, 3),
      width: '100%',
    },
    overviewTitle: {
      fontSize: '14px',
      color: theme.palette.text.secondary,
      fontWeight: 600,
    },
    overviewValue: {
      fontSize: '22px',
    },
    infoIcon: {
      fontSize: '1rem',
      marginLeft: theme.spacing(0.5),
      marginTop: '2px',
      color: theme.palette.text.secondary,
    },
    infoLabel: {
      display: 'flex',
    },
  }),
)

type StrategyProps = {
  value?: string
  label: string
  tooltip?: React.ReactNode
  priceType?: string
  link?: string
}

const StrategyInfoItem: React.FC<StrategyProps> = ({ value, label, tooltip, priceType, link }) => {
  const classes = useStyles()

  if (link) {
    return (
      <div className={classes.container}>
        <a href={link}>
          <Typography className={classes.overviewValue}>{value}</Typography>
          <div className={classes.infoLabel}>
            <Typography className={classes.overviewTitle}>{label} </Typography>
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
          </div>
        </a>
      </div>
    )
  } else {
    return (
      <div className={classes.container}>
        <Typography className={classes.overviewValue}>{value}</Typography>
        <div className={classes.infoLabel}>
          <Typography className={classes.overviewTitle}>{label} </Typography>
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
        </div>
      </div>
    )
  }
}

export default StrategyInfoItem

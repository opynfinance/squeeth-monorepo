import React from 'react'
import { Typography, Box, BoxProps, Tooltip } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import clsx from 'clsx'

interface StyleProps {
  isSmall: boolean
}

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: (props: StyleProps): string => (props.isSmall ? '16px 16px' : '20px 24px'),
      backgroundColor: theme.palette.background.stone,
      borderRadius: '12px',
    },
    label: {
      color: 'rgba(255, 255, 255, 0.5)',
      fontSize: (props: StyleProps): string => (props.isSmall ? '14px' : '15px'),
      fontWeight: 500,
      width: 'max-content',
    },
    value: {
      color: 'rgba(255, 255, 255)',
      fontSize: (props: StyleProps): string => (props.isSmall ? '15px' : '18px'),
      fontWeight: 500,
      width: 'max-content',
      fontFamily: 'DM Mono',
    },
    success: {
      color: theme.palette.success.main,
    },
    error: {
      color: theme.palette.error.main,
    },
  }),
)

interface MetricProps {
  label: string | React.ReactNode
  value: string | React.ReactNode
  textColor?: 'success' | 'error'
  isSmall?: boolean
}

const Metric: React.FC<MetricProps & BoxProps> = ({ label, value, isSmall = false, textColor, ...props }) => {
  const classes = useStyles({ isSmall })

  return (
    <Box className={classes.container} flex="1" display="flex" flexDirection="column" {...props}>
      {typeof label === 'string' ? <Typography className={classes.label}>{label}</Typography> : label}
      {typeof value === 'string' ? (
        <Typography className={clsx(classes.value, textColor && classes[textColor])}>{value}</Typography>
      ) : (
        value
      )}
    </Box>
  )
}

export default Metric

const useLabelStyles = makeStyles((theme) =>
  createStyles({
    labelContainer: {
      display: 'flex',
      alignItems: 'center',
      color: 'rgba(255, 255, 255, 0.5)',
    },
    label: {
      fontSize: '15px',
      fontWeight: 500,
      width: 'max-content',
    },
    infoIcon: {
      fontSize: '15px',
      marginLeft: theme.spacing(0.5),
    },
  }),
)

export const MetricLabel: React.FC<{ label: string; tooltipTitle?: string }> = ({ label, tooltipTitle }) => {
  const classes = useLabelStyles()

  return (
    <div className={classes.labelContainer}>
      <Typography className={classes.label}>{label}</Typography>
      {tooltipTitle ? (
        <Tooltip title={tooltipTitle}>
          <InfoIcon fontSize="small" className={classes.infoIcon} />
        </Tooltip>
      ) : null}
    </div>
  )
}

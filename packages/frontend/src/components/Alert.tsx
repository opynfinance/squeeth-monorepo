import React from 'react'
import { Box, Typography, BoxProps } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import InfoIcon from '@material-ui/icons/Info'

type AlertSeverity = 'warning' | 'error' | 'info' | 'success'

interface StylesProps {
  severity: AlertSeverity
}

const useStyles = makeStyles((theme) =>
  createStyles({
    root: {
      backgroundColor: (props: StylesProps): string => theme.palette[props.severity].light,
      border: '1px solid',
      borderColor: (props: StylesProps): string => theme.palette[props.severity].main,
      borderRadius: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '20px',
      padding: '24px',
    },
    text: {
      fontWeight: 500,
      fontSize: '15px',
    },
  }),
)

interface AlertCustomProps {
  severity: AlertSeverity
  showIcon?: boolean
}
type AlertProps = BoxProps & AlertCustomProps

const Alert: React.FC<AlertProps> = ({ severity, showIcon = true, children, ...props }) => {
  const classes = useStyles({ severity })

  return (
    <Box className={classes.root} {...props}>
      {showIcon && <InfoIcon />}
      {typeof children === 'string' ? (
        <Typography variant="body2" className={classes.text}>
          {children}
        </Typography>
      ) : (
        children
      )}
    </Box>
  )
}

export default Alert

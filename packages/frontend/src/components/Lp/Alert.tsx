import React from 'react'
import { Box, Typography, BoxProps } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import InfoIcon from '@material-ui/icons/Info'
import clsx from 'clsx'

import { useTypographyStyles } from './styles'

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
  }),
)

interface AlertCustomProps {
  severity: AlertSeverity
}
type AlertProps = BoxProps & AlertCustomProps

const Alert: React.FC<AlertProps> = ({ severity, children, ...props }) => {
  const classes = useStyles({ severity })
  const typographyClasses = useTypographyStyles()

  return (
    <Box className={classes.root} {...props}>
      <InfoIcon />
      <Typography className={clsx(typographyClasses.mediumBold, typographyClasses.smallFont)}>{children}</Typography>
    </Box>
  )
}

export default Alert

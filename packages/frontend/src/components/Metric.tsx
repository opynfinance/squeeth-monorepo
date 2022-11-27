import React from 'react'
import { Typography, Box, BoxProps } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'

interface StyleProps {
  isSmall: boolean
}

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: (props: StyleProps): string => (props.isSmall ? '16px 20px' : '20px 24px'),
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
  }),
)

interface MetricProps {
  label: string | React.ReactNode
  value: string | React.ReactNode
  isSmall?: boolean
}

const Metric: React.FC<MetricProps & BoxProps> = ({ label, value, isSmall = false, ...props }) => {
  const classes = useStyles({ isSmall })

  return (
    <Box className={classes.container} display="flex" flexDirection="column" justifyContent="center" {...props}>
      <Typography className={classes.label}>{label}</Typography>
      {typeof value === 'string' ? <Typography className={classes.value}>{value}</Typography> : value}
    </Box>
  )
}

export default Metric

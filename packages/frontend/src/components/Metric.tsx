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
      fontSize: (props: StyleProps): string => (props.isSmall ? '14px' : '18px'),
      fontWeight: 500,
      width: 'max-content',
      fontFamily: 'DM Mono',
    },
  }),
)

interface MetricProps {
  label: string
  value: string
  isSmall?: boolean
}

const Metric: React.FC<MetricProps & BoxProps> = ({ label, value, isSmall = false, ...props }) => {
  const classes = useStyles({ isSmall })

  return (
    <Box display="flex" flexDirection="column" justifyContent="center" className={classes.container} {...props}>
      <Typography className={classes.label}>{label}</Typography>
      <Typography className={classes.value}>{value}</Typography>
    </Box>
  )
}

export default Metric

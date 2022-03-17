import { createStyles, makeStyles } from '@material-ui/core/styles'
import { Box, Typography } from '@material-ui/core'
import React from 'react'

const useStyles = makeStyles((theme) =>
  createStyles({
    infoBox: {
      backgroundColor: theme.palette.background.lightStone,
      borderRadius: theme.spacing(2),
    },
    infoBoxDisabled: {
      backgroundColor: theme.palette.background.paper,
      borderRadius: theme.spacing(2),
      opacity: '0.5',
    },
    title: {
      color: theme.palette.text.secondary,
      fontSize: '15px',
    },
    value: {
      fontSize: '34px',
      fontWeight: 700,
      marginTop: theme.spacing(4),
    },
  }),
)

type LPInfoType = {
  title: string
  value: string
  disabled?: boolean
}

const LPInfoCard: React.FC<LPInfoType> = ({ title, value, disabled }) => {
  const classes = useStyles()

  return (
    <Box p={3} borderRadius={2} className={disabled ? classes.infoBoxDisabled : classes.infoBox}>
      <Typography className={classes.title}>{title}</Typography>
      <Typography className={classes.value} variant="h5">
        {value}
      </Typography>
    </Box>
  )
}

export default LPInfoCard

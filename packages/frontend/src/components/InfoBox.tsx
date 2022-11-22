import { createStyles, makeStyles } from '@material-ui/core/styles'
import { Box, BoxProps } from '@material-ui/core'
import React from 'react'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      backgroundColor: theme.palette.background.stone,
      borderRadius: '12px',
      padding: theme.spacing(2, 2.5),
    },
  }),
)

const InfoBox: React.FC<BoxProps> = (props) => {
  const classes = useStyles()
  return <Box className={classes.container} {...props} />
}

export default InfoBox

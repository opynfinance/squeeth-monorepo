import React from 'react'
import { Box, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      width: '50%',
      justifyContent: 'center',
      display: 'flex',
      alignItems: 'center',
      margin: 'auto',
      marginTop: theme.spacing(10),
    },
    title: {
      marginTop: theme.spacing(10),
    },
  }),
)

const BlockedPage: React.FC = () => {
  const classes = useStyles()

  return (
    <Box className={classes.container}>
      <Typography align="center" variant="h6" className={classes.title}>
        Seems you are using a VPN service or accessing our website from a blocked country, which is a violation of our terms of service. Please disconnect from your VPN
        and refresh the page to continue using our service.
      </Typography>
    </Box>
  )
}

export default BlockedPage

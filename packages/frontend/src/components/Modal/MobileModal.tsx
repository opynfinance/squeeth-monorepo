import { Drawer, IconButton, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import KeyboardBackspaceIcon from '@material-ui/icons/KeyboardBackspace'
import React from 'react'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      width: '100%',
      background: theme.palette.background.default,
    },
    paper: {
      background: theme.palette.background.default,
      height: '100vh',
    },
    nav: {
      height: '64px',
      position: 'fixed',
      display: 'flex',
      alignItems: 'center',
      top: 0,
      backdropFilter: 'blur(30px)',
      zIndex: 30,
      width: '100%',
    },
    title: {
      marginLeft: theme.spacing(2),
      fontSize: '18px',
    },
    body: {
      padding: theme.spacing(2),
      marginTop: '64px',
    },
  }),
)

type MobileModalType = {
  isOpen: boolean
  onClose: () => void
  title: string
}

const MobileModal: React.FC<MobileModalType> = ({ isOpen, onClose, children, title }) => {
  const classes = useStyles()

  return (
    <Drawer
      anchor="bottom"
      open={isOpen}
      onClose={onClose}
      className={classes.container}
      classes={{ paper: classes.paper }}
    >
      <div className={classes.nav}>
        <IconButton onClick={onClose}>
          <KeyboardBackspaceIcon />
        </IconButton>
        <Typography className={classes.title} variant="body1" color="primary">
          {title}
        </Typography>
      </div>
      <div className={classes.body}>{children}</div>
    </Drawer>
  )
}

export default MobileModal

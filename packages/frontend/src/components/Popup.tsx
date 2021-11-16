import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogActions from '@material-ui/core/DialogActions'
import DialogContent from '@material-ui/core/DialogContent'
import DialogContentText from '@material-ui/core/DialogContentText'
import DialogTitle from '@material-ui/core/DialogTitle'
import { createStyles, makeStyles } from '@material-ui/core/styles'
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

type PopupType = {
  dialogTitle: string
  dialogContent: string
  isOpen: boolean
  onClose: () => void
  title: string
}

export const Popup: React.FC<PopupType> = ({ isOpen, onClose, dialogTitle, dialogContent, children, title }) => {
  const classes = useStyles()

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">{dialogTitle}</DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description">{dialogContent}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" autoFocus>
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  )
}

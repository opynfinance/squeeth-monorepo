import { createStyles, IconButton, makeStyles } from '@material-ui/core'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import CloseIcon from '@material-ui/icons/Close'
import * as React from 'react'

const useStyles = makeStyles((theme) =>
  createStyles({
    dialogTitle: {
      // color: '#000',
      background: theme.palette.background.default,
      padding: '15px 20px 0',
      '&>*': {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '20px',
      },
      fontSize: '1.5rem',
    },
    dialogContent: {
      padding: '10px 10px 25px',
      background: theme.palette.background.default,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '10px',
    },
  }),
)
export interface ModalProps {
  title: string
  open: boolean
  handleClose?: () => void
}

export const Modal: React.FC<ModalProps> = ({ open, handleClose, title, children }) => {
  const classes = useStyles()

  return (
    <Dialog
      PaperProps={{
        style: { borderRadius: 20, maxWidth: 600 },
      }}
      BackdropProps={{
        style: { backdropFilter: 'blur(20px)' },
      }}
      maxWidth={'lg'}
      open={open}
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      style={{ maxWidth: '500' }}
    >
      <DialogTitle className={classes.dialogTitle} id="alert-dialog-title">
        {title}
        {handleClose && (
          <IconButton edge="start" onClick={handleClose} aria-label="close">
            <CloseIcon style={{ color: '#fff' }} />
          </IconButton>
        )}
      </DialogTitle>
      <DialogContent className={classes.dialogContent}>{children}</DialogContent>
    </Dialog>
  )
}

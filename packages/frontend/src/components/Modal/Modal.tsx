import { createStyles, IconButton, makeStyles } from '@material-ui/core'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import DialogActions from '@material-ui/core/DialogActions'
import CloseIcon from '@material-ui/icons/Close'
import * as React from 'react'

const useStyles = makeStyles((theme) =>
  createStyles({
    dialogTitle: {
      // color: '#000',
      textAlign: 'center',
      background: '#444748',
      padding: '15px 20px 0',
      '&>*': {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '20px',
      },
      fontSize: '1.25rem',
    },
    dialogContent: {
      padding: '10px 10px 25px',
      paddingBottom: '0px',
      background: '#444748',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '10px',
    },
    dialogActions: { background: '#444748' },
    title: {
      margin: '0',
    },
  }),
)
export interface ModalProps {
  title: string
  open: boolean
  handleClose?: () => void
  showCloseButton?: boolean
  id?: string
  buttonComp?: React.ReactNode
}

export const Modal: React.FC<ModalProps> = ({
  id,
  open,
  handleClose,
  title,
  children,
  buttonComp,
  showCloseButton = true,
}) => {
  const classes = useStyles()

  return (
    <Dialog
      PaperProps={{
        style: { borderRadius: 20, background: 'rgba(255, 255, 255, 0.12)', maxWidth: '500px' },
      }}
      maxWidth={false}
      open={open}
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      id={id}
    >
      <DialogTitle className={classes.dialogTitle} id="alert-dialog-title">
        <h2 className={classes.title}>{title}</h2>
        {showCloseButton && handleClose && (
          <IconButton edge="start" onClick={handleClose} aria-label="close">
            <CloseIcon style={{ color: '#fff' }} />
          </IconButton>
        )}
      </DialogTitle>
      <DialogContent className={classes.dialogContent}>{children}</DialogContent>

      {buttonComp && <DialogActions className={classes.dialogActions}>{buttonComp}</DialogActions>}
    </Dialog>
  )
}

import { createStyles, IconButton, makeStyles, Tooltip } from '@material-ui/core'
import Button from '@material-ui/core/Button'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import CloseIcon from '@material-ui/icons/Close'
import * as React from 'react'

import { useAddresses } from '../hooks/useAddress'

const useStyles = makeStyles((theme) =>
  createStyles({
    dialog: {
      textAlign: 'center',
    },
    dialogTitle: {
      color: '#000',
      background: '#fff',
      paddingTop: '20px',
      '&>*': {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      },
    },
    dialogContent: {
      padding: '0 20px',
      color: '#000',
      background: '#fff',
    },
    iframeBox: {
      width: '800px',
      height: '750px',
      border: 0,
      borderRadius: '30px',
      margin: '0 auto 20px',
      display: 'block',
      zIndex: 1,
    },
    btn: {
      margin: '20px 0',
      textTransform: 'none',
      textAlign: 'center',
      color: '#000',
      backgroundColor: theme.palette.primary.main,
      '&:hover': {
        backgroundColor: theme.palette.primary.dark,
      },
    },
  }),
)
interface UniswapIframeProps {
  text?: string
}

export const UniswapIframe: React.FC<UniswapIframeProps> = ({ text }) => {
  const classes = useStyles()
  const { wSqueeth } = useAddresses()

  const [open, setOpen] = React.useState(false)

  const handleClickOpen = () => {
    setOpen(true)
  }

  const handleClose = () => {
    setOpen(false)
  }

  return (
    <div>
      <Tooltip
        title={
          'When you click the Uniswap link, the Uniswap LP page may take a few moments to load. Please wait for it to fully load so it can prefill LP token data.'
        }
      >
        <Button className={classes.btn} variant={'outlined'} onClick={handleClickOpen}>
          <>{text} Deposit Squeeth and ETH into Uniswap V3 Pool 🦄</>
        </Button>
      </Tooltip>

      <Dialog
        PaperProps={{
          style: { borderRadius: 20 },
        }}
        maxWidth={'lg'}
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle className={classes.dialogTitle} id="alert-dialog-title">
          <span>Deposit Squeeth and ETH into Uniswap V3 Pool 🦄</span>
          <IconButton edge="start" onClick={handleClose} aria-label="close">
            <CloseIcon style={{ color: '#000' }} />
          </IconButton>
        </DialogTitle>
        <DialogContent className={classes.dialogContent}>
          <iframe
            className={classes.iframeBox}
            src={`https://squeeth-uniswap.netlify.app/#/add/ETH/${wSqueeth}/3000`}
          ></iframe>
        </DialogContent>
      </Dialog>
    </div>
  )
}

import { createStyles, IconButton, makeStyles, Tooltip } from '@material-ui/core'
import Button from '@material-ui/core/Button'
import { orange } from '@material-ui/core/colors'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import CloseIcon from '@material-ui/icons/Close'
import OpenInNewIcon from '@material-ui/icons/OpenInNew'
import * as React from 'react'

import { Tooltips } from '../../constants/enums'
import { useAddresses } from '../../hooks/useAddress'
import useCopyClipboard from '../../hooks/useCopyClipboard'

const useStyles = makeStyles((theme) =>
  createStyles({
    dialog: {
      textAlign: 'center',
    },
    dialogTitle: {
      // color: '#000',
      background: theme.palette.background.default,
      paddingTop: '0px',
      paddingBottom: '0px',
      '&>*': {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      },
    },
    dialogContent: {
      padding: '0 20px',
      background: theme.palette.background.default,
    },
    iframeBox: {
      width: '800px',
      height: '80vh',
      border: 0,
      borderRadius: '30px',
      margin: '0 auto 20px',
      display: 'block',
      zIndex: 1,
    },
    uniswapWarning: {
      color: orange[700],
      fontWeight: 600,
      fontSize: 15,
    },
    uniswapHeaderDiv: {
      display: 'flex',
      justifyContent: 'space-between',
      paddingRight: '20px',
      paddingLeft: '5px',
    },
    uniOpenBtn: {
      display: 'flex',
      alignItems: 'center',
      color: theme.palette.primary.main,
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
  const [isCopied, setCopied] = useCopyClipboard()

  const [open, setOpen] = React.useState(false)

  const handleClickOpen = () => {
    setOpen(true)
  }

  const handleClose = () => {
    setOpen(false)
  }

  return (
    <div>
      <Tooltip title={Tooltips.UniswapLoading}>
        <Button className={classes.btn} variant={'outlined'} onClick={handleClickOpen}>
          <>{text} Deposit Squeeth and ETH into Uniswap V3 Pool 🦄</>
        </Button>
      </Tooltip>

      <Dialog
        PaperProps={{
          style: { borderRadius: 20 },
        }}
        BackdropProps={{
          style: { backdropFilter: 'blur(20px)' },
        }}
        maxWidth={'lg'}
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle className={classes.dialogTitle} id="alert-dialog-title">
          <p>Deposit Squeeth and ETH into Uniswap V3 Pool 🦄</p>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => {
              setCopied(wSqueeth)
            }}
          >
            {' '}
            {isCopied ? (
              <>Copied</>
            ) : (
              <>
                oSQTH: {wSqueeth?.substring(0, 6)}...{wSqueeth?.substring(wSqueeth.length - 4)}
              </>
            )}
          </Button>
          <IconButton edge="start" onClick={handleClose} aria-label="close">
            <CloseIcon style={{ color: '#fff' }} />
          </IconButton>
        </DialogTitle>
        <DialogContent className={classes.dialogContent}>
          <div className={classes.uniswapHeaderDiv}>
            <p className={classes.uniswapWarning}>Please connect your wallet with Uniswap</p>
            <a
              className={classes.uniOpenBtn}
              href={`https://squeeth-uniswap.netlify.app/#/add/ETH/${wSqueeth}/3000`}
              target="_blank"
              rel="noreferrer"
            >
              <p>Open in Uniswap</p>
              <OpenInNewIcon style={{ fontSize: 16, marginLeft: '4px' }} fontSize="small" />
            </a>
          </div>
          <iframe
            className={classes.iframeBox}
            src={`https://squeeth-uniswap.netlify.app/#/add/ETH/${wSqueeth}/3000`}
          ></iframe>
        </DialogContent>
      </Dialog>
    </div>
  )
}

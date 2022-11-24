import { createStyles, IconButton, InputAdornment, makeStyles, TextField, Typography } from '@material-ui/core'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import SettingsIcon from '@material-ui/icons/Settings'
import BigNumber from 'bignumber.js'
import * as React from 'react'

const useStyles = makeStyles((theme) =>
  createStyles({
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
    settingsButton: {
      color: theme.palette.text.secondary,
    },
    slippageInput: {
      width: 300,
      marginBottom: theme.spacing(4),
    },
  }),
)

type TradeSettingsProps = {
  setSlippage: (amt: BigNumber) => void
  slippage: BigNumber
}

export const TradeSettings: React.FC<TradeSettingsProps> = ({ setSlippage, slippage }) => {
  const classes = useStyles()

  const [slippageAmount, setSlippageAmount] = React.useState(slippage.toString())

  const [open, setOpen] = React.useState(false)

  const handleOpen = () => {
    setOpen(true)
  }

  const handleClose = () => {
    setOpen(false)
    setSlippage(new BigNumber(slippageAmount))
  }

  return (
    <div>
      <IconButton onClick={handleOpen} className={classes.settingsButton} size={'small'}>
        <SettingsIcon />
      </IconButton>

      <Dialog
        PaperProps={{
          style: { borderRadius: 20 },
        }}
        BackdropProps={{
          style: { backdropFilter: 'blur(5px)' },
        }}
        maxWidth={'lg'}
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        disableScrollLock
      >
        <DialogTitle className={classes.dialogTitle} id="alert-dialog-title">
          <p>Slippage Tolerance</p>
        </DialogTitle>
        <DialogContent className={classes.dialogContent}>
          <TextField
            size="small"
            value={slippageAmount}
            type="number"
            className={classes.slippageInput}
            margin="dense"
            onChange={(event) => setSlippageAmount(event.target.value)}
            id="filled-basic"
            label="Slippage Tolerance"
            variant="outlined"
            error={Number(slippageAmount) < 0.05 || Number(slippageAmount) > 1}
            helperText={
              Number(slippageAmount) < 0.05
                ? 'Your transaction may fail'
                : Number(slippageAmount) > 1
                ? 'Your transaction may be frontrun'
                : null
            }
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Typography variant="caption">%</Typography>
                </InputAdornment>
              ),
            }}
            inputProps={{
              min: '0',
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

import { createStyles, IconButton, InputAdornment, makeStyles, TextField, Typography } from '@material-ui/core'
import Dialog from '@material-ui/core/Dialog'
import DialogContent from '@material-ui/core/DialogContent'
import DialogTitle from '@material-ui/core/DialogTitle'
import SettingsIcon from '@material-ui/icons/Settings'
import BigNumber from 'bignumber.js'
import * as React from 'react'

import { slippageAmountAtom } from 'src/state/trade/atoms'
import { useAtom } from 'jotai'

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
  isCrab?: boolean
  setCrabSlippage?: (amt: BigNumber) => void
  crabSlippage?: BigNumber
}

export const TradeSettings: React.FC<TradeSettingsProps> = ({ isCrab, setCrabSlippage, crabSlippage }) => {
  const classes = useStyles()

  const [slippageAmount, setSlippageAmount] = useAtom(slippageAmountAtom)

  const [open, setOpen] = React.useState(false)

  const handleOpen = () => {
    setOpen(true)
  }

  const handleClose = () => {
    setOpen(false)
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
      >
        <DialogTitle className={classes.dialogTitle} id="alert-dialog-title">
          <p>Slippage Tolerance</p>
        </DialogTitle>
        <DialogContent className={classes.dialogContent}>
          <TextField
            size="small"
            value={isCrab ? crabSlippage : slippageAmount}
            type="number"
            className={classes.slippageInput}
            margin="dense"
            onChange={
              isCrab
                ? (event) => (setCrabSlippage ? setCrabSlippage(new BigNumber(event.target.value)) : null)
                : (event) => setSlippageAmount(new BigNumber(event.target.value))
            }
            id="filled-basic"
            label="Slippage Tolerance"
            variant="outlined"
            error={slippageAmount.lte(0.05) || slippageAmount.gte(1)}
            helperText={
              slippageAmount.lte(0.05)
                ? 'Your transaction may fail'
                : slippageAmount.gte(1)
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

import { Button, ButtonGroup, createStyles, Fade, makeStyles, Modal } from '@material-ui/core'
import Backdrop from '@material-ui/core/Backdrop'
import BigNumber from 'bignumber.js'
import React from 'react'
import { useState } from 'react'

import Buy from './Buy'
import History from './History'
import Sell from './Sell'

enum TradeType {
  BUY,
  SELL,
}

type TradeProps = {
  setTradeType: (arg0: TradeType) => void
  tradeType: TradeType
  setAmount: (arg0: number) => void
  amount: number
  setCost: (arg0: number) => void
  cost: number
  setSqueethExposure: (arg0: number) => void
  squeethExposure: number
}

const useStyles = makeStyles((theme) =>
  createStyles({
    modal: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    paper: {
      backgroundColor: theme.palette.background.paper,
      boxShadow: theme.shadows[5],
      padding: theme.spacing(2, 4),
      borderRadius: theme.spacing(1),
      width: '40rem',
      height: '60vh',
    },
  }),
)

const Trade: React.FC<TradeProps> = ({
  setTradeType,
  tradeType,
  setAmount,
  amount,
  setCost,
  cost,
  setSqueethExposure,
  squeethExposure,
}) => {
  // const [tradeType, setTradeType] = useState(TradeType.BUY)
  const [modelOpen, setModelOpen] = useState(false)
  const classes = useStyles()

  return (
    <div>
      <ButtonGroup color="primary" aria-label="outlined primary button group">
        <Button
          style={{ textTransform: 'none' }}
          onClick={() => setTradeType(TradeType.BUY)}
          variant={tradeType === TradeType.BUY ? 'contained' : 'outlined'}
        >
          {' '}
          Long{' '}
        </Button>
        <Button
          style={{ textTransform: 'none' }}
          onClick={() => setTradeType(TradeType.SELL)}
          variant={tradeType === TradeType.SELL ? 'contained' : 'outlined'}
        >
          {' '}
          Short{' '}
        </Button>
      </ButtonGroup>
      <div>
        {tradeType === TradeType.BUY ? (
          <Buy
            amount={amount}
            setAmount={setAmount}
            cost={cost}
            setCost={setCost}
            squeethExposure={squeethExposure}
            setSqueethExposure={setSqueethExposure}
          />
        ) : (
          <Sell />
        )}
        <Button
          color="primary"
          size="small"
          style={{ marginTop: '4px', background: 'none' }}
          onClick={() => setModelOpen(true)}
        >
          Transaction history
        </Button>
        <Modal
          aria-labelledby="enable-notification"
          open={modelOpen}
          className={classes.modal}
          onClose={() => setModelOpen(false)}
          closeAfterTransition
          BackdropComponent={Backdrop}
          BackdropProps={{
            timeout: 500,
          }}
        >
          <Fade in={modelOpen}>
            <div className={classes.paper}>
              <History />
            </div>
          </Fade>
        </Modal>
      </div>
    </div>
  )
}

export default Trade

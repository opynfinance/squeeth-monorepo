import { Button, ButtonGroup, createStyles, Fade, makeStyles, Modal, Tab, Tabs } from '@material-ui/core'
import Backdrop from '@material-ui/core/Backdrop'
import React from 'react'
import { useState } from 'react'

import { useWallet } from '../../context/wallet'
import { toTokenAmount } from '../../utils/calculations'
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
  const { balance } = useWallet()

  return (
    <div>
      <Tabs value={tradeType} onChange={(evt, val) => setTradeType(val)} aria-label="simple tabs example" centered>
        <Tab label="Long" />
        <Tab label="Short" />
      </Tabs>
      <div>
        {tradeType === TradeType.BUY ? (
          <Buy
            amount={amount}
            setAmount={setAmount}
            cost={cost}
            setCost={setCost}
            squeethExposure={squeethExposure}
            setSqueethExposure={setSqueethExposure}
            balance={Number(toTokenAmount(balance, 18).toFixed(4))}
          />
        ) : (
          <Sell balance={Number(toTokenAmount(balance, 18).toFixed(4))} />
        )}
        {/* <Button
          color="primary"
          size="small"
          style={{ marginTop: '4px', background: 'none' }}
          onClick={() => setModelOpen(true)}
        >
          Transaction history
        </Button> */}
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

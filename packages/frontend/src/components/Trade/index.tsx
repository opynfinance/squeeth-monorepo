import { Button, ButtonGroup } from '@material-ui/core'
import React from 'react'
import { useState } from 'react'

import Buy from './Buy'
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
}

const Trade: React.FC<TradeProps> = ({ setTradeType, tradeType, setAmount, amount }) => {
  // const [tradeType, setTradeType] = useState(TradeType.BUY)

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
      <div>{tradeType === TradeType.BUY ? <Buy amount={amount} setAmount={setAmount} /> : <Sell />}</div>
    </div>
  )
}

export default Trade

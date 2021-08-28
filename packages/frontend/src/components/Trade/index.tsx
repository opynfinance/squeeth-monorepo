import { Button, ButtonGroup } from '@material-ui/core'
import React from 'react'
import { useState } from 'react'

import Buy from './Buy'
import Sell from './Sell'

enum TradeType {
  BUY,
  SELL,
}

const Trade: React.FC = () => {
  const [tradeType, setTradeType] = useState(TradeType.BUY)

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
      <div>{tradeType === TradeType.BUY ? <Buy /> : <Sell />}</div>
    </div>
  )
}

export default Trade

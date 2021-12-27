import { createStyles, makeStyles } from '@material-ui/core'
import React from 'react'

import { useTrade } from '@context/trade'
import { useWallet } from '@context/wallet'
import { TradeType } from '../../types'
import { toTokenAmount } from '@utils/calculations'
import { SecondaryTab, SecondaryTabs } from '../Tabs'
import Long from './Long'
import Short from './Short'

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
    tabBackGround: {
      position: 'sticky',
      top: '0',
      zIndex: 20,
      background: '#2A2D2E',
    },
  }),
)

type tradeType = {
  setTradeCompleted: any
}

const Trade: React.FC<tradeType> = ({ setTradeCompleted }) => {
  const classes = useStyles()
  const { balance } = useWallet()
  const { tradeType, openPosition, setOpenPosition } = useTrade()

  return (
    <div>
      {
        <SecondaryTabs
          value={openPosition}
          onChange={(evt, val) => setOpenPosition(val)}
          aria-label="simple tabs example"
          centered
          variant="fullWidth"
          className={classes.tabBackGround}
        >
          <SecondaryTab label="Open" />
          <SecondaryTab label="Close" />
        </SecondaryTabs>
      }
      <div>
        {tradeType === TradeType.LONG ? (
          <Long
            balance={Number(toTokenAmount(balance, 18).toFixed(4))}
            open={openPosition === 0}
            closeTitle="Sell squeeth ERC20 to get ETH"
            setTradeCompleted={setTradeCompleted}
          />
        ) : (
          <Short
            balance={Number(toTokenAmount(balance, 18).toFixed(4))}
            open={openPosition === 0}
            closeTitle="Buy back oSQTH & close position"
            setTradeCompleted={setTradeCompleted}
          />
        )}
      </div>
    </div>
  )
}

export default Trade

import { createStyles, makeStyles } from '@material-ui/core'
import React from 'react'

import { TradeType } from '../../types'
import { SecondaryTab, SecondaryTabs } from '../Tabs'
import Long from './Long'
import Short from './Short'
import { ethTradeAmountAtom, openPositionAtom, sqthTradeAmountAtom, tradeTypeAtom } from 'src/state/trade/atoms'
import { useAtom, useAtomValue } from 'jotai'
import { useResetAtom } from 'jotai/utils'
import { isTransactionFirstStepAtom, transactionDataAtom, transactionLoadingAtom } from 'src/state/wallet/atoms'

const useStyles = makeStyles(() =>
  createStyles({
    tabBackGround: {
      position: 'sticky',
      top: '0',
      zIndex: 20,
      background: '#2A2D2E',
    },
  }),
)

const Trade: React.FC = () => {
  const classes = useStyles()

  const resetEthTradeAmount = useResetAtom(ethTradeAmountAtom)
  const resetSqthTradeAmount = useResetAtom(sqthTradeAmountAtom)
  const tradeType = useAtomValue(tradeTypeAtom)
  const [openPosition, setOpenPosition] = useAtom(openPositionAtom)
  const resetTransactionData = useResetAtom(transactionDataAtom)
  const transactionInProgress = useAtomValue(transactionLoadingAtom)
  const isTxFirstStep = useAtomValue(isTransactionFirstStepAtom)

  return (
    <div id="trade-card">
      {
        <SecondaryTabs
          value={openPosition}
          onChange={(evt, val) => {
            setOpenPosition(val)

            if (!transactionInProgress || !isTxFirstStep) {
              resetEthTradeAmount()
              resetSqthTradeAmount()
              resetTransactionData()
            }
          }}
          aria-label="simple tabs example"
          centered
          variant="fullWidth"
          className={classes.tabBackGround}
        >
          <SecondaryTab label="Open" id="open-btn" />
          <SecondaryTab label="Close" id="close-btn" />
        </SecondaryTabs>
      }
      <div>
        {tradeType === TradeType.LONG ? <Long open={openPosition === 0} /> : <Short open={openPosition === 0} />}
      </div>
    </div>
  )
}

export default Trade

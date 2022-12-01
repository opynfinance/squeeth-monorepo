import React from 'react'
import { Box, BoxProps } from '@material-ui/core'
import { useAtom, useAtomValue } from 'jotai'
import { useResetAtom } from 'jotai/utils'

import { isTransactionFirstStepAtom, transactionDataAtom, transactionLoadingAtom } from '@state/wallet/atoms'
import { ethTradeAmountAtom, openPositionAtom, sqthTradeAmountAtom, tradeTypeAtom } from '@state/trade/atoms'
import { SqueethTabNew, SqueethTabsNew } from '@components/Tabs'
import { TradeType } from 'src/types'
import Long from './Long'
import Short from './Short'

const Trade: React.FC<BoxProps> = (props) => {
  const resetEthTradeAmount = useResetAtom(ethTradeAmountAtom)
  const resetSqthTradeAmount = useResetAtom(sqthTradeAmountAtom)
  const tradeType = useAtomValue(tradeTypeAtom)
  const [openPosition, setOpenPosition] = useAtom(openPositionAtom)
  const resetTransactionData = useResetAtom(transactionDataAtom)
  const transactionInProgress = useAtomValue(transactionLoadingAtom)
  const isTxFirstStep = useAtomValue(isTransactionFirstStepAtom)

  return (
    <Box id="trade-card" {...props}>
      <SqueethTabsNew
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
      >
        <SqueethTabNew label="Open" id="open-btn" />
        <SqueethTabNew label="Close" id="close-btn" />
      </SqueethTabsNew>

      <div>
        {tradeType === TradeType.LONG ? <Long open={openPosition === 0} /> : <Short open={openPosition === 0} />}
      </div>
    </Box>
  )
}

export default Trade

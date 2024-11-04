import React from 'react'
import { Box, BoxProps } from '@material-ui/core'
import { useAtom, useAtomValue } from 'jotai'

import { openPositionAtom, tradeTypeAtom } from '@state/trade/atoms'
import { TradeType } from 'src/types'
import Long from './Long'
import Short from './Short'

const Trade: React.FC<BoxProps> = (props) => {
  const tradeType = useAtomValue(tradeTypeAtom)
  const [openPosition, setOpenPosition] = useAtom(openPositionAtom)

  return (
    <Box id="trade-card" {...props}>
      {/* <SqueethTabsNew
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
      </SqueethTabsNew> */}

      <Box>{tradeType === TradeType.LONG ? <Long /> : <Short open={openPosition === 0} />}</Box>
    </Box>
  )
}

export default Trade

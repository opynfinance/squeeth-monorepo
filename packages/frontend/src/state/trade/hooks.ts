import { useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { useUpdateAtom } from 'jotai/utils'

import { tradeTypeAtom, actualTradeTypeAtom } from './atoms'
import { positionTypeAtom } from '../positions/atoms'
import { PositionType, TradeType } from '../../types'

export const useUpdateActualTradeType = () => {
  const tradeType = useAtomValue(tradeTypeAtom)
  const positionType = useAtomValue(positionTypeAtom)
  const setActualTradeType = useUpdateAtom(actualTradeTypeAtom)

  useEffect(() => {
    if (tradeType === TradeType.LONG) {
      if (positionType === PositionType.SHORT) setActualTradeType(TradeType.SHORT)
      else setActualTradeType(TradeType.LONG)
    } else {
      if (positionType === PositionType.LONG) setActualTradeType(TradeType.LONG)
      else setActualTradeType(TradeType.SHORT)
    }
  }, [positionType, tradeType])
}

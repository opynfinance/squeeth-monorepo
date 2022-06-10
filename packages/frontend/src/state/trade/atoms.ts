import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import BigNumber from 'bignumber.js'

import { BIG_ZERO, DEFAULT_SLIPPAGE, InputType } from '@constants/index'
import { PositionType, TradeType } from '../../types'
import { positionTypeAtom } from '../positions/atoms'

const quoteEmptyState = {
  amountOut: BIG_ZERO,
  minimumAmountOut: BIG_ZERO,
  priceImpact: '0',
  pools: Array<Array<any>>()
}

const sellCloseEmptyState = {
  amountIn: BIG_ZERO,
  maximumAmountIn: BIG_ZERO,
  priceImpact: '0',
}

export const slippageAmountAtom = atom(new BigNumber(DEFAULT_SLIPPAGE))
export const tradeTypeAtom = atom(TradeType.LONG)
export const tradeLoadingAtom = atom(false)
export const tradeSuccessAtom = atom(false)
export const tradeCompletedAtom = atomWithReset(false)
export const openPositionAtom = atom(0)
export const quoteAtom = atom(quoteEmptyState)
export const inputQuoteLoadingAtom = atom(false)
export const squeethExposureAtom = atom(0)
export const confirmedAmountAtom = atom('0')
export const isOpenPositionAtom = atom((get) => {
  const openPosition = get(openPositionAtom)
  return openPosition === 0
})
export const inputTypeAtom = atomWithReset(InputType.ETH)
export const tradeAmountAtom = atomWithReset('0')
export const altTradeAmountAtom = atomWithReset('0')
export const inputQuoteAtom = atomWithReset('')
export const sellCloseQuoteAtom = atomWithReset(sellCloseEmptyState)

export const ethTradeAmountAtom = atomWithReset('0')
export const sqthTradeAmountAtom = atomWithReset('0')
export const transactionHashAtom = atomWithReset('')

export const actualTradeTypeAtom = atom((get) => {
  const tradeType = get(tradeTypeAtom)
  const positionType = get(positionTypeAtom)

  if (tradeType === TradeType.LONG) {
    if (positionType === PositionType.SHORT) return TradeType.SHORT
    else return TradeType.LONG
  } else {
    if (positionType === PositionType.LONG) return TradeType.LONG
    else return TradeType.SHORT
  }
})

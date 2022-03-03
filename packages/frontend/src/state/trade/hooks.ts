import { useEffect } from 'react'
import BigNumber from 'bignumber.js'
import { useAtomValue } from 'jotai'
import { useResetAtom, useUpdateAtom } from 'jotai/utils'

import {
  tradeAmountAtom,
  slippageAmountAtom,
  altTradeAmountAtom,
  tradeTypeAtom,
  tradeSuccessAtom,
  quoteAtom,
  inputQuoteAtom,
  inputQuoteLoadingAtom,
  inputTypeAtom,
  sellCloseQuoteAtom,
  squeethExposureAtom,
  actualTradeTypeAtom,
  confirmedAmountAtom,
  isOpenPositionAtom,
} from './atoms'
import { positionTypeAtom } from '../positions/atoms'
import { readyAtom } from '../squeethPool/atoms'
import { InputType } from '@constants/index'
import { PositionType, TradeType } from '../../types'
import {
  useGetBuyQuote,
  useGetBuyQuoteForETH,
  useGetSellQuote,
  useGetSellQuoteForETH,
  useGetWSqueethPositionValue,
} from '../squeethPool/hooks'

export const useResetTradeForm = () => {
  const tradeSuccess = useAtomValue(tradeSuccessAtom)
  const tradeType = useAtomValue(tradeTypeAtom)
  const isPositionOpen = useAtomValue(isOpenPositionAtom)
  const resetTradeAmount = useResetAtom(tradeAmountAtom)
  const resetAltTradeAmount = useResetAtom(altTradeAmountAtom)
  const resetInputQuote = useResetAtom(inputQuoteAtom)
  const resetSellCloseQuote = useResetAtom(sellCloseQuoteAtom)
  useEffect(() => {
    resetTradeAmount()
    resetAltTradeAmount()
    resetInputQuote()
    resetSellCloseQuote()
  }, [tradeSuccess, tradeType, isPositionOpen])
}

export const useTradeUpdate = () => {
  const positionType = useAtomValue(positionTypeAtom)
  const ready = useAtomValue(readyAtom)
  const tradeType = useAtomValue(tradeTypeAtom)
  const tradeAmount = useAtomValue(tradeAmountAtom)
  const altTradeAmount = useAtomValue(altTradeAmountAtom)
  const inputType = useAtomValue(inputTypeAtom)
  const slippageAmount = useAtomValue(slippageAmountAtom)
  const isPositionOpen = useAtomValue(isOpenPositionAtom)

  const setInputQuoteLoading = useUpdateAtom(inputQuoteLoadingAtom)
  const setQuote = useUpdateAtom(quoteAtom)
  const setInputQuote = useUpdateAtom(inputQuoteAtom)
  const setSellCloseQuote = useUpdateAtom(sellCloseQuoteAtom)
  const setConfirmedAmount = useUpdateAtom(confirmedAmountAtom)

  const getBuyQuoteForETH = useGetBuyQuoteForETH()
  const getSellQuote = useGetSellQuote()
  const getBuyQuote = useGetBuyQuote()
  const getSellQuoteForETH = useGetSellQuoteForETH()

  useEffect(() => {
    if (!ready) return
    setInputQuoteLoading(true)
    //tradeType refers to which tab "Long" or "Short" is selected on the trade page
    //positionType refers to the user's actual position based on their squeeth balances and debt
    //isPositionOpen is true if the "Open" tab is selected on the trade page; otherwise it refers to the "Close" tab being selected
    if (tradeType === TradeType.LONG) {
      if (positionType === PositionType.SHORT) {
        getBuyQuote(new BigNumber(tradeAmount), slippageAmount).then(setSellCloseQuote)
      } else if (isPositionOpen) {
        getBuyQuoteForETH(new BigNumber(tradeAmount), slippageAmount).then(setQuote)
      } else {
        getSellQuote(new BigNumber(tradeAmount), slippageAmount).then(setQuote)
      }
      if (isPositionOpen) {
        if (inputType === InputType.ETH) {
          getBuyQuoteForETH(new BigNumber(tradeAmount), slippageAmount).then((val) => {
            if (tradeAmount !== '0') setConfirmedAmount(val.amountOut.toFixed(6).toString())
            setInputQuote(val.amountOut.toString())
          })
        } else {
          getBuyQuote(new BigNumber(altTradeAmount), slippageAmount).then((val) => {
            if (altTradeAmount !== '0') setConfirmedAmount(Number(altTradeAmount).toFixed(6).toString())
            setInputQuote(val.amountIn.toString())
          })
        }
      } else {
        if (inputType === InputType.ETH) {
          getSellQuoteForETH(new BigNumber(altTradeAmount), slippageAmount).then((val) => {
            if (altTradeAmount !== '0') setConfirmedAmount(val.amountIn.toFixed(6).toString())
            setInputQuote(val.amountIn.toString())
          })
        } else {
          getSellQuote(new BigNumber(tradeAmount), slippageAmount).then((val) => {
            if (altTradeAmount !== '0') setConfirmedAmount(Number(tradeAmount).toFixed(6))
            setInputQuote(val.amountOut.toString())
          })
        }
      }
    } else {
      if (positionType === PositionType.LONG) {
        getSellQuote(new BigNumber(tradeAmount), slippageAmount).then(setQuote)
      } else if (isPositionOpen) {
        getSellQuote(new BigNumber(tradeAmount), slippageAmount).then(setQuote)
      } else {
        getBuyQuote(new BigNumber(tradeAmount), slippageAmount).then(setSellCloseQuote)
      }
    }
    setInputQuoteLoading(false)
  }, [
    altTradeAmount,
    inputType,
    isPositionOpen,
    positionType,
    ready,
    slippageAmount.toString(),
    tradeAmount,
    tradeType,
  ])

  return { tradeType, tradeAmount, altTradeAmount, inputType, slippageAmount, isPositionOpen }
}

export const useTradeAmountUpdate = () => {
  const isPositionOpen = useAtomValue(isOpenPositionAtom)
  const inputType = useAtomValue(inputTypeAtom)
  const inputQuote = useAtomValue(inputQuoteAtom)
  const setAltTradeAmount = useUpdateAtom(altTradeAmountAtom)
  const setInputQuoteLoading = useUpdateAtom(inputQuoteLoadingAtom)
  const setTradeAmount = useUpdateAtom(tradeAmountAtom)
  useEffect(() => {
    // if quote changes, set the quote to trade amount and reset loading state
    if (isPositionOpen) {
      if (inputType === InputType.ETH) setAltTradeAmount(inputQuote)
      else setTradeAmount(inputQuote)
    } else {
      if (inputType === InputType.ETH) setTradeAmount(inputQuote)
      else setAltTradeAmount(inputQuote)
    }
    setInputQuoteLoading(false)
  }, [inputQuote, inputType, isPositionOpen])

  return { isPositionOpen, inputType, inputQuote }
}

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

export const useUpdateSqueethExposure = () => {
  const tradeType = useAtomValue(tradeTypeAtom)
  const setSqueethExposure = useUpdateAtom(squeethExposureAtom)
  const quote = useAtomValue(quoteAtom)
  const amountOutBN = quote.amountOut
  const getWSqueethPositionValue = useGetWSqueethPositionValue()
  useEffect(() => {
    if (tradeType === TradeType.LONG) {
      setSqueethExposure(Number(getWSqueethPositionValue(amountOutBN)))
    }
  }, [tradeType, amountOutBN.toString()])
}

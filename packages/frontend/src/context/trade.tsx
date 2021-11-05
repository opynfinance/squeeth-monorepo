import BigNumber from 'bignumber.js'
import React, { useContext, useEffect, useMemo, useState } from 'react'

import { useSqueethPool } from '../hooks/contracts/useSqueethPool'
import { useLongPositions, usePnL, useShortPositions } from '../hooks/usePositions'
import { PositionType, TradeType } from '../types'

type Quote = {
  amountOut: BigNumber
  minimumAmountOut: BigNumber
  priceImpact: string
}

type SellCloseQuote = {
  amountIn: BigNumber
  maximumAmountIn: BigNumber
  priceImpact: string
}

type tradeContextType = {
  tradeAmount: BigNumber
  setTradeAmount: (amt: BigNumber) => void
  tradeType: TradeType
  setTradeType: (type: TradeType) => void
  tradeLoading: boolean
  setTradeLoading: (loading: boolean) => void
  tradeSuccess: boolean
  setTradeSuccess: (state: boolean) => void
  openPosition: number
  setOpenPosition: (o: number) => void
  isOpenPosition: boolean
  actualTradeType: TradeType
  squeethExposure: number
  quote: Quote
  sellCloseQuote: SellCloseQuote
  altTradeAmount: BigNumber
  setAltTradeAmount: (amt: BigNumber) => void
}

const quoteEmptyState = {
  amountOut: new BigNumber(0),
  minimumAmountOut: new BigNumber(0),
  priceImpact: '0',
}

const sellCloseEmptyState = {
  amountIn: new BigNumber(0),
  maximumAmountIn: new BigNumber(0),
  priceImpact: '0',
}

const initialState: tradeContextType = {
  tradeAmount: new BigNumber(1),
  setTradeAmount: () => null,
  tradeType: TradeType.LONG,
  setTradeType: () => null,
  tradeLoading: false,
  setTradeLoading: () => null,
  tradeSuccess: false,
  setTradeSuccess: () => null,
  openPosition: 0,
  setOpenPosition: () => null,
  isOpenPosition: true,
  actualTradeType: TradeType.LONG,
  squeethExposure: 0,
  quote: quoteEmptyState,
  sellCloseQuote: sellCloseEmptyState,
  altTradeAmount: new BigNumber(1),
  setAltTradeAmount: () => null,
}

const tradeContext = React.createContext<tradeContextType>(initialState)
const useTrade = () => useContext(tradeContext)

const TradeProvider: React.FC = ({ children }) => {
  const [tradeAmount, setTradeAmount] = useState(new BigNumber(0))
  const [altTradeAmount, setAltTradeAmount] = useState(new BigNumber(0))
  const [tradeType, setTradeType] = useState(TradeType.LONG)
  const [tradeLoading, setTradeLoading] = useState(false)
  const [tradeSuccess, setTradeSuccess] = useState(false)
  const [openPosition, setOpenPosition] = useState(0)
  const [quote, setQuote] = useState(quoteEmptyState)
  const [sellCloseQuote, setSellCloseQuote] = useState(sellCloseEmptyState)
  const [squeethExposure, setSqueethExposure] = useState(0)
  const [actualTradeType, setActualTradeType] = useState(TradeType.LONG)

  const { ready, sell, getBuyQuoteForETH, buyForWETH, getSellQuote, getWSqueethPositionValue, getBuyQuote } =
    useSqueethPool()
  const { positionType } = usePnL()

  const amountOut = quote.amountOut.toNumber()
  const isPositionOpen = useMemo(() => openPosition === 0, [openPosition])

  useEffect(() => {
    if (!ready) return

    if (tradeType === TradeType.LONG) {
      if (positionType === PositionType.SHORT) {
        getBuyQuote(tradeAmount).then(setSellCloseQuote)
      } else if (isPositionOpen) {
        getBuyQuoteForETH(tradeAmount).then(setQuote)
      } else {
        getSellQuote(tradeAmount).then(setQuote)
      }
    } else {
      if (positionType === PositionType.LONG) {
        getSellQuote(tradeAmount).then(setQuote)
      } else if (isPositionOpen) {
        getSellQuote(tradeAmount).then(setQuote)
      } else {
        getBuyQuote(tradeAmount).then(setSellCloseQuote)
      }
    }
  }, [tradeAmount.toNumber(), tradeType, isPositionOpen, ready, positionType])

  useEffect(() => {
    if (tradeType === TradeType.LONG) {
      if (positionType === PositionType.SHORT) setActualTradeType(TradeType.SHORT)
      else setActualTradeType(TradeType.LONG)
    } else {
      if (positionType === PositionType.LONG) setActualTradeType(TradeType.LONG)
      else setActualTradeType(TradeType.SHORT)
    }
  }, [positionType, tradeType])

  useEffect(() => {
    if (tradeType === TradeType.LONG) {
      setSqueethExposure(Number(getWSqueethPositionValue(amountOut)))
    }
  }, [tradeType, amountOut])

  const store: tradeContextType = {
    tradeAmount,
    setTradeAmount,
    tradeType,
    setTradeType,
    tradeLoading,
    setTradeLoading,
    tradeSuccess,
    setTradeSuccess,
    openPosition,
    setOpenPosition,
    isOpenPosition: isPositionOpen,
    actualTradeType,
    squeethExposure,
    quote,
    sellCloseQuote,
    altTradeAmount,
    setAltTradeAmount,
  }

  return <tradeContext.Provider value={store}>{children}</tradeContext.Provider>
}

export { TradeProvider, useTrade }

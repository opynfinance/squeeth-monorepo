import BigNumber from 'bignumber.js'
import React, { useContext, useEffect, useMemo, useState } from 'react'

import { DEFAULT_SLIPPAGE, InputType } from '../constants/index'
import { useSqueethPool } from '@hooks/contracts/useSqueethPool'
import { PositionType, TradeType } from '../types'
import { usePositions } from './positions'

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
  tradeAmount: string
  setTradeAmount: (amt: string) => void
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
  inputQuote: string
  setInputQuote: (q: string) => void
  inputQuoteLoading: boolean
  setInputQuoteLoading: (bool: boolean) => void
  inputType: InputType
  setInputType: (type: InputType) => void
  sellCloseQuote: SellCloseQuote
  altTradeAmount: string
  setAltTradeAmount: (amt: string) => void
  slippageAmount: BigNumber
  setSlippageAmount: (amt: BigNumber) => void
  confirmedAmount: string
  setConfirmedAmount: (amt: string) => void
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
  tradeAmount: '1',
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
  inputQuote: '',
  setInputQuote: () => null,
  quote: quoteEmptyState,
  inputQuoteLoading: false,
  setInputQuoteLoading: () => null,
  sellCloseQuote: sellCloseEmptyState,
  inputType: InputType.ETH,
  setInputType: () => null,
  altTradeAmount: '1',
  setAltTradeAmount: () => null,
  slippageAmount: new BigNumber(DEFAULT_SLIPPAGE),
  setSlippageAmount: () => null,
  confirmedAmount: '0',
  setConfirmedAmount: () => null,
}

const tradeContext = React.createContext<tradeContextType>(initialState)
const useTrade = () => useContext(tradeContext)

const TradeProvider: React.FC = ({ children }) => {
  const [tradeAmount, setTradeAmount] = useState('0')
  const [slippageAmount, setSlippageAmount] = useState(new BigNumber(DEFAULT_SLIPPAGE))
  const [altTradeAmount, setAltTradeAmount] = useState('0')
  const [tradeType, setTradeType] = useState(TradeType.LONG)
  const [tradeLoading, setTradeLoading] = useState(false)
  const [tradeSuccess, setTradeSuccess] = useState(false)
  const [openPosition, setOpenPosition] = useState(0)
  const [quote, setQuote] = useState(quoteEmptyState)
  const [inputQuote, setInputQuote] = useState('')
  const [inputQuoteLoading, setInputQuoteLoading] = useState(false)
  const [inputType, setInputType] = useState(InputType.ETH)
  const [sellCloseQuote, setSellCloseQuote] = useState(sellCloseEmptyState)
  const [squeethExposure, setSqueethExposure] = useState(0)
  const [actualTradeType, setActualTradeType] = useState(TradeType.LONG)
  const [confirmedAmount, setConfirmedAmount] = useState('0')

  const {
    ready,
    sell,
    getBuyQuoteForETH,
    buyForWETH,
    getSellQuote,
    getWSqueethPositionValue,
    getBuyQuote,
    getSellQuoteForETH,
  } = useSqueethPool()
  const { positionType } = usePositions()

  const amountOutBN = quote.amountOut
  const isPositionOpen = useMemo(() => openPosition === 0, [openPosition])

  useEffect(() => {
    setTradeAmount('0')
    setAltTradeAmount('0')
    setInputQuote('0')
  }, [tradeSuccess, tradeType, isPositionOpen])

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
    tradeAmount,
    altTradeAmount,
    inputType,
    tradeType,
    isPositionOpen,
    ready,
    positionType,
    slippageAmount.toString(),
  ])

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
      setSqueethExposure(Number(getWSqueethPositionValue(amountOutBN)))
    }
  }, [tradeType, amountOutBN.toString()])

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
    inputQuote,
    setInputQuote,
    inputQuoteLoading,
    setInputQuoteLoading,
    confirmedAmount,
    setConfirmedAmount,
    inputType,
    setInputType,
    altTradeAmount,
    setAltTradeAmount,
    slippageAmount,
    setSlippageAmount,
  }

  return <tradeContext.Provider value={store}>{children}</tradeContext.Provider>
}

export { TradeProvider, useTrade }

import { useQuery } from '@apollo/client'
import BigNumber from 'bignumber.js'
import { useEffect, useMemo, useState } from 'react'

import { useWallet } from '../context/wallet'
import { useWorldContext } from '../context/world'
import { swaps, swapsVariables } from '../queries/uniswap/__generated__/swaps'
import SWAPS_QUERY from '../queries/uniswap/swapsQuery'
import { PositionType } from '../types'
import { useSqueethPool } from './contracts/useSqueethPool'
import { useAddresses } from './useAddress'
import { useETHPrice } from './useETHPrice'
import useInterval from './useInterval'

const bigZero = new BigNumber(0)

export const useLongPositions = () => {
  const { squeethPool, weth, wSqueeth, swapRouter } = useAddresses()
  const { address } = useWallet()
  const { ethPriceMap } = useWorldContext()
  const { data, loading, refetch } = useQuery<swaps, swapsVariables>(SWAPS_QUERY, {
    variables: {
      poolAddress: squeethPool.toLowerCase(),
      origin: address || '',
      recipients: [address || '', swapRouter],
      orderDirection: 'asc',
    },
    fetchPolicy: 'cache-and-network',
  })

  useInterval(refetch, 5000)

  const swaps = data?.swaps
  const isWethToken0 = parseInt(weth, 16) < parseInt(wSqueeth, 16)

  const { squeethAmount, wethAmount, usdAmount } = swaps?.reduce(
    (acc, s) => {
      acc.squeethAmount = acc.squeethAmount.plus(new BigNumber(isWethToken0 ? s.amount1 : s.amount0).negated())
      acc.wethAmount = acc.wethAmount.plus(new BigNumber(isWethToken0 ? s.amount0 : s.amount1).negated())
      const time = new Date(Number(s.timestamp) * 1000).setUTCHours(0, 0, 0) / 1000
      acc.usdAmount = acc.usdAmount.plus(
        new BigNumber(isWethToken0 ? s.amount0 : s.amount1).negated().multipliedBy(ethPriceMap[time]),
      )
      if (acc.squeethAmount.isZero()) {
        acc.usdAmount = bigZero
        acc.wethAmount = bigZero
      }
      return acc
    },
    { squeethAmount: bigZero, wethAmount: bigZero, usdAmount: bigZero },
  ) || { squeethAmount: bigZero, wethAmount: bigZero, usdAmount: bigZero }

  return {
    swaps,
    loading,
    squeethAmount,
    wethAmount,
    usdAmount,
  }
}

export const useShortPositions = () => {
  const { squeethPool, weth, wSqueeth, shortHelper } = useAddresses()
  const { address } = useWallet()
  const { ethPriceMap } = useWorldContext()
  const { data, loading, refetch } = useQuery<swaps, swapsVariables>(SWAPS_QUERY, {
    variables: {
      poolAddress: squeethPool.toLowerCase(),
      origin: address || '',
      recipients: [shortHelper],
      orderDirection: 'asc',
    },
    fetchPolicy: 'cache-and-network',
  })

  useInterval(refetch, 5000)

  const swaps = data?.swaps
  const isWethToken0 = parseInt(weth, 16) < parseInt(wSqueeth, 16)

  const { squeethAmount, wethAmount, usdAmount } = swaps?.reduce(
    (acc, s) => {
      acc.squeethAmount = acc.squeethAmount.plus(new BigNumber(isWethToken0 ? s.amount1 : s.amount0).negated())
      acc.wethAmount = acc.wethAmount.plus(new BigNumber(isWethToken0 ? s.amount0 : s.amount1).negated())
      const time = new Date(Number(s.timestamp) * 1000).setUTCHours(0, 0, 0) / 1000
      acc.usdAmount = acc.usdAmount.plus(
        new BigNumber(isWethToken0 ? s.amount0 : s.amount1).negated().multipliedBy(ethPriceMap[time]),
      )
      if (acc.squeethAmount.isZero()) {
        acc.usdAmount = bigZero
        acc.wethAmount = bigZero
      }
      return acc
    },
    { squeethAmount: bigZero, wethAmount: bigZero, usdAmount: bigZero },
  ) || { squeethAmount: bigZero, wethAmount: bigZero, usdAmount: bigZero }

  return {
    swaps,
    loading,
    squeethAmount: squeethAmount.absoluteValue(),
    wethAmount,
    usdAmount,
  }
}

export const usePnL = () => {
  const { usdAmount: longUsdAmt, squeethAmount: wSqueethBal } = useLongPositions()
  const { usdAmount: shortUsdAmt, squeethAmount: shortSqueethAmt } = useShortPositions()
  const ethPrice = useETHPrice()
  const { ready, getSellQuote, getBuyQuote } = useSqueethPool()

  const [sellQuote, setSellQuote] = useState({
    amountOut: new BigNumber(0),
    minimumAmountOut: new BigNumber(0),
    priceImpact: '0',
  })
  const [buyQuote, setBuyQuote] = useState(new BigNumber(0))
  const [longGain, setLongGain] = useState(0)
  const [shortGain, setShortGain] = useState(0)

  const positionType = useMemo(() => {
    if (wSqueethBal.isGreaterThan(0)) return PositionType.LONG
    if (shortSqueethAmt.isGreaterThan(0)) return PositionType.SHORT
    else return PositionType.NONE
  }, [wSqueethBal.toNumber(), shortSqueethAmt.toNumber()])

  //console.log(positionType)

  useEffect(() => {
    if (!ready) return

    getSellQuote(wSqueethBal.toNumber()).then(setSellQuote)
    getBuyQuote(shortSqueethAmt.toNumber()).then((val) => setBuyQuote(val.amountIn))
  }, [wSqueethBal.toNumber(), ready])

  useEffect(() => {
    const _currentValue = sellQuote.amountOut
      .times(ethPrice || 0)
      .div(longUsdAmt.absoluteValue())
      .times(100)
    const _gain = _currentValue.minus(100)
    setLongGain(_gain.toNumber())
  }, [ethPrice.toNumber(), longUsdAmt.toNumber(), sellQuote.amountOut.toNumber()])
  // }, [wSqueethBal.toNumber(), sellQuote.amountOut.toNumber(), ethPrice.toNumber(), longUsdAmt.toNumber()])

  useEffect(() => {
    const _currentValue = buyQuote
      .times(ethPrice || 0)
      .div(shortUsdAmt.absoluteValue())
      .times(100)
    const _gain = _currentValue.minus(100)
    setShortGain(_gain.toNumber())
  }, [buyQuote.toNumber(), ethPrice.toNumber(), shortUsdAmt.toNumber()])
  // }, [shortSqueethAmt.toNumber(), buyQuote.toNumber(), ethPrice.toNumber(), shortUsdAmt.toNumber()])

  return {
    longGain,
    shortGain,
    buyQuote,
    sellQuote,
    longUsdAmt,
    shortUsdAmt,
    wSqueethBal,
    shortSqueethAmt,
    positionType,
  }
}

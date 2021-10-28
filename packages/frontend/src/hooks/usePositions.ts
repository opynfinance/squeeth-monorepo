import { useQuery } from '@apollo/client'
import BigNumber from 'bignumber.js'
import { useEffect, useMemo, useState } from 'react'

import { useWallet } from '../context/wallet'
import { useWorldContext } from '../context/world'
import { swaps, swapsVariables } from '../queries/uniswap/__generated__/swaps'
import SWAPS_QUERY from '../queries/uniswap/swapsQuery'
import { PositionType } from '../types'
import { useController } from './contracts/useController'
import { useSqueethPool } from './contracts/useSqueethPool'
import { useVaultManager } from './contracts/useVaultManager'
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

  const { vaults: shortVaults } = useVaultManager(5)
  const { getDebtAmount, normFactor: normalizationFactor } = useController()

  const [existingCollatPercent, setExistingCollatPercent] = useState(0)
  const [existingCollat, setExistingCollat] = useState(0)
  const [liquidationPrice, setLiquidationPrice] = useState(0)
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

  useEffect(() => {
    if (squeethAmount.absoluteValue().isGreaterThan(0) && shortVaults.length) {
      const _collat: BigNumber = shortVaults[0].collateralAmount
      setExistingCollat(_collat.toNumber())
      getDebtAmount(squeethAmount.absoluteValue()).then((debt) => {
        if (debt && debt.isPositive()) {
          setExistingCollatPercent(Number(_collat.div(debt).times(100).toFixed(1)))
          const rSqueeth = normalizationFactor.multipliedBy(squeethAmount.absoluteValue()).dividedBy(10000)
          setLiquidationPrice(_collat.div(rSqueeth.multipliedBy(1.5)).toNumber())
        }
      })
    }
  }, [squeethAmount.toNumber(), shortVaults.length])

  return {
    swaps,
    loading,
    squeethAmount: squeethAmount.absoluteValue(),
    wethAmount,
    usdAmount,
    shortVaults,
    liquidationPrice,
    existingCollat,
    existingCollatPercent,
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
  const [loading, setLoading] = useState(true)

  const positionType = useMemo(() => {
    if (wSqueethBal.isGreaterThan(0)) return PositionType.LONG
    if (shortSqueethAmt.isGreaterThan(0)) return PositionType.SHORT
    else return PositionType.NONE
  }, [wSqueethBal.toNumber(), shortSqueethAmt.toNumber()])

  useEffect(() => {
    if (!ready) return

    const p1 = getSellQuote(wSqueethBal.toNumber()).then(setSellQuote)
    const p2 = getBuyQuote(shortSqueethAmt.toNumber()).then((val) => setBuyQuote(val.amountIn))
    Promise.all([p1, p2]).then(() => setLoading(false))
  }, [wSqueethBal.toNumber(), ready])

  useEffect(() => {
    const _currentValue = sellQuote.amountOut
      .times(ethPrice || 0)
      .div(longUsdAmt.absoluteValue())
      .times(100)
    const _gain = _currentValue.minus(100)
    setLongGain(_gain.toNumber())
  }, [ethPrice.toNumber(), longUsdAmt.toNumber(), sellQuote.amountOut.toNumber()])

  useEffect(() => {
    const _currentValue = buyQuote
      .times(ethPrice || 0)
      .div(shortUsdAmt.absoluteValue())
      .times(100)
    const _gain = _currentValue.minus(100)
    setShortGain(_gain.toNumber())
  }, [buyQuote.toNumber(), ethPrice.toNumber(), shortUsdAmt.toNumber()])

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
    loading,
  }
}

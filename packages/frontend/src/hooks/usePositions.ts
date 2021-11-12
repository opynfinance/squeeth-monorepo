import { useQuery } from '@apollo/client'
import { Position } from '@uniswap/v3-sdk'
import BigNumber from 'bignumber.js'
import { useEffect, useMemo, useState } from 'react'

import NFTpositionManagerABI from '../abis/NFTpositionmanager.json'
import { useWallet } from '../context/wallet'
import { useWorldContext } from '../context/world'
import { positions, positionsVariables } from '../queries/uniswap/__generated__/positions'
import { swaps, swapsVariables } from '../queries/uniswap/__generated__/swaps'
import POSITIONS_QUERY from '../queries/uniswap/positionsQuery'
import SWAPS_QUERY from '../queries/uniswap/swapsQuery'
import { NFTManagers, PositionType } from '../types'
import { toTokenAmount } from '../utils/calculations'
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

  const {
    squeethAmount,
    wethAmount,
    usdAmount,
    realizedETH,
    realizedSqueeth,
    totalETHSpent,
    totalSqueeth,
    totalUSDSpent,
    realizedUSD,
  } = useMemo(
    () =>
      swaps?.reduce(
        (acc, s) => {
          const squeethAmt = new BigNumber(isWethToken0 ? s.amount1 : s.amount0)
          const wethAmt = new BigNumber(isWethToken0 ? s.amount0 : s.amount1)
          const time = new Date(Number(s.timestamp) * 1000).setUTCHours(0, 0, 0) / 1000
          const usdAmt = wethAmt.multipliedBy(ethPriceMap[time])

          acc.squeethAmount = acc.squeethAmount.plus(squeethAmt.negated())
          acc.wethAmount = acc.wethAmount.plus(wethAmt.negated())
          if (squeethAmt.isNegative()) {
            acc.totalSqueeth = acc.totalSqueeth.plus(squeethAmt.abs())
            acc.totalETHSpent = acc.totalETHSpent.plus(wethAmt.abs())
            acc.totalUSDSpent = acc.totalUSDSpent.plus(usdAmt.abs())
          } else if (squeethAmt.isPositive()) {
            acc.realizedSqueeth = acc.realizedSqueeth.plus(squeethAmt.abs())
            acc.realizedETH = acc.realizedETH.plus(wethAmt.abs())
            acc.realizedUSD = acc.realizedUSD.plus(usdAmt.abs())
          }
          acc.usdAmount = acc.usdAmount.plus(usdAmt)
          if (acc.squeethAmount.isZero()) {
            acc.usdAmount = bigZero
            acc.wethAmount = bigZero
          }
          return acc
        },
        {
          squeethAmount: bigZero,
          wethAmount: bigZero,
          usdAmount: bigZero,
          realizedSqueeth: bigZero,
          realizedETH: bigZero,
          realizedUSD: bigZero,
          totalSqueeth: bigZero,
          totalETHSpent: bigZero,
          totalUSDSpent: bigZero,
        },
      ) || {
        squeethAmount: bigZero,
        wethAmount: bigZero,
        usdAmount: bigZero,
        realizedSqueeth: bigZero,
        realizedETH: bigZero,
        realizedUSD: bigZero,
        totalSqueeth: bigZero,
        totalETHSpent: bigZero,
        totalUSDSpent: bigZero,
      },
    [ethPriceMap, isWethToken0, swaps],
  )

  const { realizedPNL } = useMemo(() => {
    if (!realizedSqueeth.gt(0)) return { realizedPNL: bigZero }

    const costForOneSqth = totalUSDSpent.div(totalSqueeth)
    const realizedForOneSqth = realizedUSD.div(realizedSqueeth)
    const pnlForOneSqth = realizedForOneSqth.minus(costForOneSqth)

    return { realizedPNL: pnlForOneSqth.multipliedBy(realizedSqueeth) }
  }, [realizedSqueeth.toNumber(), realizedUSD.toNumber()])

  return {
    swaps,
    loading,
    squeethAmount,
    wethAmount,
    usdAmount,
    realizedPNL,
    refetch,
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
  const [existingCollat, setExistingCollat] = useState(new BigNumber(0))
  const [liquidationPrice, setLiquidationPrice] = useState(0)
  const swaps = data?.swaps
  const isWethToken0 = parseInt(weth, 16) < parseInt(wSqueeth, 16)

  const {
    squeethAmount,
    wethAmount,
    usdAmount,
    realizedETH,
    realizedSqueeth,
    totalETH,
    totalSqueeth,
    totalUSDReceived,
    realizedUSD,
  } = useMemo(
    () =>
      swaps?.reduce(
        (acc, s) => {
          const squeethAmt = new BigNumber(isWethToken0 ? s.amount1 : s.amount0)
          const wethAmt = new BigNumber(isWethToken0 ? s.amount0 : s.amount1)
          const time = new Date(Number(s.timestamp) * 1000).setUTCHours(0, 0, 0) / 1000
          const usdAmt = wethAmt.multipliedBy(ethPriceMap[time])

          acc.squeethAmount = acc.squeethAmount.plus(squeethAmt.negated())
          acc.wethAmount = acc.wethAmount.plus(wethAmt.negated())
          if (squeethAmt.isPositive()) {
            acc.totalSqueeth = acc.totalSqueeth.plus(squeethAmt.abs())
            acc.totalETH = acc.totalETH.plus(wethAmt.abs())
            acc.totalUSDReceived = acc.totalUSDReceived.plus(usdAmt.abs())
          } else if (squeethAmt.isNegative()) {
            acc.realizedSqueeth = acc.realizedSqueeth.plus(squeethAmt.abs())
            acc.realizedETH = acc.realizedETH.plus(wethAmt.abs())
            acc.realizedUSD = acc.realizedUSD.plus(usdAmt.abs())
          }
          acc.usdAmount = acc.usdAmount.plus(usdAmt.negated())
          if (acc.squeethAmount.isZero()) {
            acc.usdAmount = bigZero
            acc.wethAmount = bigZero
          }
          return acc
        },
        {
          squeethAmount: bigZero,
          wethAmount: bigZero,
          usdAmount: bigZero,
          realizedSqueeth: bigZero,
          realizedETH: bigZero,
          realizedUSD: bigZero,
          totalSqueeth: bigZero,
          totalETH: bigZero,
          totalUSDReceived: bigZero,
        },
      ) || {
        squeethAmount: bigZero,
        wethAmount: bigZero,
        usdAmount: bigZero,
        realizedSqueeth: bigZero,
        realizedETH: bigZero,
        totalSqueeth: bigZero,
        totalETH: bigZero,
        totalUSDReceived: bigZero,
        realizedUSD: bigZero,
      },
    [ethPriceMap, isWethToken0, swaps?.length],
  )

  useEffect(() => {
    if (shortVaults.length && shortVaults[0].shortAmount) {
      const _collat: BigNumber = shortVaults[0].collateralAmount
      setExistingCollat(_collat)
      getDebtAmount(new BigNumber(shortVaults[0].shortAmount)).then((debt) => {
        if (debt && debt.isPositive()) {
          setExistingCollatPercent(Number(_collat.div(debt).times(100).toFixed(1)))
          const rSqueeth = normalizationFactor.multipliedBy(new BigNumber(shortVaults[0].amount)).dividedBy(10000)
          setLiquidationPrice(_collat.div(rSqueeth.multipliedBy(1.5)).toNumber())
        }
      })
    }
  }, [squeethAmount.toNumber(), shortVaults.length])

  const { realizedPNL } = useMemo(() => {
    if (!realizedSqueeth.gt(0)) return { realizedPNL: bigZero }

    const costForOneSqth = totalUSDReceived.div(totalSqueeth)
    const realizedForOneSqth = realizedUSD.div(realizedSqueeth)
    const pnlForOneSqth = realizedForOneSqth.minus(costForOneSqth)

    return { realizedPNL: pnlForOneSqth.multipliedBy(realizedSqueeth) }
  }, [realizedSqueeth.toNumber(), realizedUSD.toNumber()])

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
    realizedSqueeth,
    realizedETH,
    realizedUSD,
    realizedPNL,
    refetch,
  }
}

export const usePnL = () => {
  const {
    usdAmount: longUsdAmt,
    squeethAmount: wSqueethBal,
    realizedPNL: longRealizedPNL,
    refetch: refetchLong,
  } = useLongPositions()
  const {
    usdAmount: shortUsdAmt,
    squeethAmount: shortSqueethAmt,
    realizedPNL: shortRealizedPNL,
    refetch: refetchShort,
  } = useShortPositions()
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

  const refetch = () => {
    refetchLong()
    refetchShort()
  }

  useEffect(() => {
    if (!ready) return

    const p1 = getSellQuote(wSqueethBal).then(setSellQuote)
    const p2 = getBuyQuote(shortSqueethAmt).then((val) => setBuyQuote(val.amountIn))
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
    shortRealizedPNL,
    longRealizedPNL,
    refetch,
  }
}

export const useLPPositions = () => {
  const { address, web3 } = useWallet()
  const { squeethPool, nftManager } = useAddresses()
  const { pool } = useSqueethPool()

  const [positions, setPositions] = useState<NFTManagers[]>([])

  const { data, loading, refetch } = useQuery<positions, positionsVariables>(POSITIONS_QUERY, {
    variables: {
      poolAddress: squeethPool.toLowerCase(),
      owner: address?.toLowerCase() || '',
    },
    fetchPolicy: 'cache-and-network',
  })

  const manager = new web3.eth.Contract(NFTpositionManagerABI as any, nftManager?.toLowerCase() || '')
  const MAX_UNIT = '0xffffffffffffffffffffffffffffffff'

  const positionAndFees = useMemo(() => {
    if (!pool) return []
    return (
      data?.positions.map(async (p) => {
        const position = { ...p }
        const tokenIdHexString = new BigNumber(position.id).toString()
        const uniPosition = new Position({
          pool,
          liquidity: new BigNumber(position.liquidity).toString(),
          tickLower: Number(position.tickLower.tickIdx),
          tickUpper: Number(position.tickUpper.tickIdx),
        })

        const fees = await manager.methods
          .collect({
            tokenId: tokenIdHexString,
            recipient: address,
            amount0Max: MAX_UNIT,
            amount1Max: MAX_UNIT,
          })
          .call()

        return {
          ...position,
          amount0: new BigNumber(uniPosition.amount0.toSignificant(18)),
          amount1: new BigNumber(uniPosition.amount1.toSignificant(18)),
          fees0: toTokenAmount(fees?.amount0, 18),
          fees1: toTokenAmount(fees?.amount1, 18),
        }
      }) || []
    )
  }, [data?.positions, pool])

  useEffect(() => {
    if (positionAndFees) {
      Promise.all(positionAndFees).then((values) => {
        setPositions(values)
      })
    }
  }, [positionAndFees.length])

  return {
    positions: positions,
    loading,
    refetch,
  }
}

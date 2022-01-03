import { useQuery } from '@apollo/client'
import { Position } from '@uniswap/v3-sdk'
import BigNumber from 'bignumber.js'
import { useCallback, useEffect, useMemo, useState } from 'react'

import NFTpositionManagerABI from '../abis/NFTpositionmanager.json'
import { useWallet } from '@context/wallet'
import { useWorldContext } from '@context/world'
import { positions, positionsVariables } from '../queries/uniswap/__generated__/positions'
import { swaps, swapsVariables } from '../queries/uniswap/__generated__/swaps'
import POSITIONS_QUERY, { POSITIONS_SUBSCRIPTION } from '../queries/uniswap/positionsQuery'
import SWAPS_QUERY from '../queries/uniswap/swapsQuery'
import { NFTManagers, PositionType } from '../types'
import { toTokenAmount } from '@utils/calculations'
import { useController } from './contracts/useController'
import { useSqueethPool } from './contracts/useSqueethPool'
import { useVaultManager } from './contracts/useVaultManager'
import { useAddresses } from './useAddress'
import { useETHPrice } from './useETHPrice'
import useInterval from './useInterval'
import { useUsdAmount } from './useUsdAmount'

const bigZero = new BigNumber(0)

export const usePositions = () => {
  const { squeethPool, weth, wSqueeth, shortHelper, swapRouter } = useAddresses()
  const { address } = useWallet()
  const { getUsdAmt } = useUsdAmount()
  const { getDebtAmount, normFactor: normalizationFactor } = useController()

  const [positionType, setPositionType] = useState('')

  const { data, loading, refetch } = useQuery<swaps, swapsVariables>(SWAPS_QUERY, {
    variables: {
      poolAddress: squeethPool?.toLowerCase(),
      origin: address || '',
      recipients: [shortHelper, address || '', swapRouter],
      orderDirection: 'asc',
    },
    fetchPolicy: 'cache-and-network',
  })

  useInterval(refetch, 5000)

  const { vaults: shortVaults } = useVaultManager(5)
  const [existingCollatPercent, setExistingCollatPercent] = useState(0)
  const [existingCollat, setExistingCollat] = useState(new BigNumber(0))
  const [liquidationPrice, setLiquidationPrice] = useState(0)
  const [isMintedBal, setIsMintedBal] = useState(false)
  const [firstValidVault, setFirstValidVault] = useState(0)

  const swaps = data?.swaps
  const isWethToken0 = parseInt(weth, 16) < parseInt(wSqueeth, 16)
  const vaultId = shortVaults[firstValidVault]?.id || 0

  const { squeethAmount, wethAmount } = useMemo(
    () =>
      swaps?.reduce(
        (acc, s) => {
          //values are all from the pool pov
          //if >0 for the pool, user gave some squeeth to the pool, meaning selling the squeeth
          const squeethAmt = new BigNumber(isWethToken0 ? s.amount1 : s.amount0)
          const wethAmt = new BigNumber(isWethToken0 ? s.amount0 : s.amount1)
          const usdAmt = getUsdAmt(wethAmt, s.timestamp)

          //buy one squeeth means -1 to the pool, +1 to the user
          acc.squeethAmount = acc.squeethAmount.plus(squeethAmt.negated())
          acc.wethAmount = acc.wethAmount.plus(wethAmt.negated())

          //<0 means, buying squeeth
          //>0 means selling squeeth
          acc.totalSqueeth = acc.totalSqueeth.plus(squeethAmt)
          acc.totalETHSpent = acc.totalETHSpent.plus(wethAmt)
          acc.totalUSDSpent = acc.totalUSDSpent.plus(usdAmt)

          acc.usdAmount = acc.usdAmount.plus(usdAmt)
          if (acc.squeethAmount.isZero()) {
            acc.usdAmount = bigZero
            acc.wethAmount = bigZero
            acc.totalSqueeth = bigZero
            acc.totalETHSpent = bigZero
            acc.totalUSDSpent = bigZero
          }

          return acc
        },
        {
          squeethAmount: bigZero,
          wethAmount: bigZero,
          usdAmount: bigZero,
          totalSqueeth: bigZero,
          totalETHSpent: bigZero,
          totalUSDSpent: bigZero,
        },
      ) || {
        squeethAmount: bigZero,
        wethAmount: bigZero,
        usdAmount: bigZero,
        totalSqueeth: bigZero,
        totalETHSpent: bigZero,
        totalUSDSpent: bigZero,
      },
    [isWethToken0, swaps],
  )

  useEffect(() => {
    ;(function determinePositionType() {
      if (squeethAmount.isGreaterThan(0)) {
        return setPositionType(PositionType.LONG)
      } else if (squeethAmount.isLessThan(0)) {
        return setPositionType(PositionType.SHORT)
      } else return setPositionType(PositionType.NONE)
    })()
  }, [squeethAmount.toNumber()])

  useEffect(() => {
    for (let i = 0; i < shortVaults.length; i++) {
      if (shortVaults[i]?.collateralAmount.isGreaterThan(0)) {
        setFirstValidVault(i)
      }
    }
  }, [shortVaults, shortVaults.length])

  useEffect(() => {
    if (shortVaults.length && shortVaults[firstValidVault]?.collateralAmount) {
      const _collat: BigNumber = shortVaults[firstValidVault].collateralAmount
      setExistingCollat(_collat)
      getDebtAmount(new BigNumber(shortVaults[firstValidVault]?.shortAmount)).then((debt) => {
        if (debt && debt.isPositive()) {
          setIsMintedBal(true)
          setExistingCollatPercent(Number(_collat.div(debt).times(100).toFixed(1)))
          const rSqueeth = normalizationFactor
            .multipliedBy(new BigNumber(shortVaults[firstValidVault]?.shortAmount))
            .dividedBy(10000)
          setLiquidationPrice(_collat.div(rSqueeth.multipliedBy(1.5)).toNumber())
        } else {
          setIsMintedBal(false)
        }
      })
    } else {
      setIsMintedBal(false)
    }
  }, [squeethAmount.toNumber(), shortVaults.length])

  return {
    swaps,
    loading,
    squeethAmount: squeethAmount.absoluteValue(),
    wethAmount,
    shortVaults,
    refetch,
    positionType,
    existingCollatPercent,
    existingCollat,
    liquidationPrice,
    isMintedBal,
    firstValidVault,
    vaultId,
  }
}

export const useLongPositions = () => {
  const { squeethPool, weth, wSqueeth, swapRouter } = useAddresses()
  const { address } = useWallet()
  const { ethPriceMap, eth90daysPriceMap, ethWithinOneDayPriceMap } = useWorldContext()
  const { getUsdAmt } = useUsdAmount()
  // all the swaps, from squeeth to eth and eth to squeeth
  const { data, loading, refetch } = useQuery<swaps, swapsVariables>(SWAPS_QUERY, {
    variables: {
      poolAddress: squeethPool?.toLowerCase(),
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
          //values are all from the pool pov
          //if >0 for the pool, user gave some squeeth to the tool, meaning selling the squeeth
          const squeethAmt = new BigNumber(isWethToken0 ? s.amount1 : s.amount0)
          const wethAmt = new BigNumber(isWethToken0 ? s.amount0 : s.amount1)
          const usdAmt = getUsdAmt(wethAmt, s.timestamp)

          //buy one squeeth means -1 to the pool, +1 to the user
          acc.squeethAmount = acc.squeethAmount.plus(squeethAmt.negated())
          acc.wethAmount = acc.wethAmount.plus(wethAmt.negated())
          //<0 means, buying squeeth
          //>0 means selling squeeth
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
    [ethPriceMap, eth90daysPriceMap, ethWithinOneDayPriceMap, isWethToken0, swaps],
  )

  const { realizedPNL } = useMemo(() => {
    if (!realizedSqueeth.gt(0)) return { realizedPNL: bigZero }

    const costForOneSqth = totalUSDSpent.div(totalSqueeth)
    const realizedForOneSqth = realizedUSD.div(realizedSqueeth)
    const pnlForOneSqth = realizedForOneSqth.minus(costForOneSqth)

    return {
      realizedPNL: pnlForOneSqth.multipliedBy(realizedSqueeth),
    }
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
  const { ethPriceMap, eth90daysPriceMap, ethWithinOneDayPriceMap } = useWorldContext()
  const { getUsdAmt } = useUsdAmount()

  const { data, loading, refetch } = useQuery<swaps, swapsVariables>(SWAPS_QUERY, {
    variables: {
      poolAddress: squeethPool?.toLowerCase(),
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
  const [isMintedBal, setIsMintedBal] = useState(false)
  const [firstValidVault, setFirstValidVault] = useState(0)

  const swaps = data?.swaps
  const isWethToken0 = parseInt(weth, 16) < parseInt(wSqueeth, 16)
  const vaultId = shortVaults[firstValidVault]?.id || 0

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
          //if >0 means you are buying squeeth to close position
          //fi <0 means you are shorting squeeth to open a new position
          const squeethAmt = new BigNumber(isWethToken0 ? s.amount1 : s.amount0)
          const wethAmt = new BigNumber(isWethToken0 ? s.amount0 : s.amount1)
          // console.log('time90days', time90days)
          const usdAmt = getUsdAmt(wethAmt, s.timestamp)

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
    [ethPriceMap, ethWithinOneDayPriceMap, eth90daysPriceMap, isWethToken0, swaps?.length],
  )

  useEffect(() => {
    for (let i = 0; i < shortVaults.length; i++) {
      if (shortVaults[i]?.collateralAmount.isGreaterThan(0)) {
        setFirstValidVault(i)
      }
    }
  }, [shortVaults, shortVaults.length])

  useEffect(() => {
    if (shortVaults.length && shortVaults[firstValidVault]?.collateralAmount) {
      const _collat: BigNumber = shortVaults[firstValidVault].collateralAmount
      setExistingCollat(_collat)
      getDebtAmount(new BigNumber(shortVaults[firstValidVault]?.shortAmount)).then((debt) => {
        if (debt && debt.isPositive()) {
          setIsMintedBal(true)
          setExistingCollatPercent(Number(_collat.div(debt).times(100).toFixed(1)))
          const rSqueeth = normalizationFactor
            .multipliedBy(new BigNumber(shortVaults[firstValidVault]?.shortAmount))
            .dividedBy(10000)
          setLiquidationPrice(_collat.div(rSqueeth.multipliedBy(1.5)).toNumber())
        } else {
          setIsMintedBal(false)
        }
      })
    } else {
      setIsMintedBal(false)
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
    isMintedBal,
    shortVaults,
    firstValidVault,
    liquidationPrice,
    existingCollat,
    existingCollatPercent,
    realizedSqueeth,
    realizedETH,
    realizedUSD,
    realizedPNL,
    vaultId,
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
    // shortVaults: shortSqueethVaults,
    realizedPNL: shortRealizedPNL,
    refetch: refetchShort,
    // squeethAmount: shortSQueethAmount,
  } = useShortPositions()
  const { positionType, squeethAmount, wethAmount, shortVaults, firstValidVault, vaultId } = usePositions()
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

  const refetch = () => {
    refetchLong()
    refetchShort()
  }

  useEffect(() => {
    if (!ready) return

    const p1 = getSellQuote(squeethAmount).then(setSellQuote)
    const p2 = getBuyQuote(squeethAmount).then((val) => setBuyQuote(val.amountIn))
    Promise.all([p1, p2]).then(() => setLoading(false))
  }, [squeethAmount.toNumber(), ready, shortVaults])

  useEffect(() => {
    const _currentValue = sellQuote.amountOut
      // .times(ethPrice || 0)
      .div(wethAmount.absoluteValue())
      .times(100)
    const _gain = _currentValue.minus(100)
    setLongGain(_gain.toNumber())
  }, [ethPrice.toNumber(), wethAmount.toNumber(), sellQuote.amountOut.toNumber()])

  useEffect(() => {
    const _currentValue = buyQuote
      // .times(ethPrice || 0)
      .div(wethAmount.absoluteValue())
      .times(100)
    const _gain = new BigNumber(100).minus(_currentValue)
    setShortGain(_gain.toNumber())
  }, [buyQuote.toNumber(), ethPrice.toNumber(), wethAmount.toNumber()])

  return {
    longGain,
    shortGain,
    buyQuote,
    sellQuote,
    longUsdAmt,
    shortUsdAmt,
    wSqueethBal,
    positionType,
    loading,
    shortRealizedPNL,
    longRealizedPNL,
    refetch,
  }
}

export const useLPPositions = () => {
  const { address, web3 } = useWallet()
  const { squeethPool, nftManager, weth, wSqueeth } = useAddresses()
  const { pool, getWSqueethPositionValue, squeethInitialPrice } = useSqueethPool()
  const ethPrice = useETHPrice()

  const [activePositions, setActivePositions] = useState<NFTManagers[]>([])
  const [closedPositions, setClosedPositions] = useState<NFTManagers[]>([])
  const [loading, setLoading] = useState(true)

  const {
    data,
    refetch,
    loading: gphLoading,
    subscribeToMore,
  } = useQuery<positions, positionsVariables>(POSITIONS_QUERY, {
    variables: {
      poolAddress: squeethPool?.toLowerCase(),
      owner: address?.toLowerCase() || '',
    },
    fetchPolicy: 'cache-and-network',
  })

  const manager = new web3.eth.Contract(NFTpositionManagerABI as any, nftManager?.toLowerCase() || '')
  const MAX_UNIT = '0xffffffffffffffffffffffffffffffff'

  useEffect(() => {
    setLoading(true)
  }, [address])

  useEffect(() => {
    subscribeToNewPositions()
  }, [])

  const subscribeToNewPositions = useCallback(() => {
    subscribeToMore({
      document: POSITIONS_SUBSCRIPTION,
      variables: {
        poolAddress: squeethPool?.toLowerCase(),
        owner: address?.toLowerCase() || '',
      },
      updateQuery(prev, { subscriptionData }) {
        if (!subscriptionData.data) return prev
        const newPosition = subscriptionData.data.positions
        return {
          positions: newPosition,
        }
      },
    })
  }, [squeethPool, address])

  const isWethToken0 = useMemo(() => parseInt(weth, 16) < parseInt(wSqueeth, 16), [weth, wSqueeth])

  const positionAndFees = useMemo(() => {
    if (!pool || !squeethInitialPrice.toNumber() || !ethPrice.toNumber()) return []
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

        const squeethAmt = isWethToken0
          ? new BigNumber(uniPosition.amount1.toSignificant(18))
          : new BigNumber(uniPosition.amount0.toSignificant(18))

        const wethAmt = isWethToken0
          ? new BigNumber(uniPosition.amount0.toSignificant(18))
          : new BigNumber(uniPosition.amount1.toSignificant(18))

        const squeethFees = isWethToken0 ? toTokenAmount(fees?.amount1, 18) : toTokenAmount(fees?.amount0, 18)
        const wethFees = isWethToken0 ? toTokenAmount(fees?.amount0, 18) : toTokenAmount(fees?.amount1, 18)

        const dollarValue = getWSqueethPositionValue(squeethAmt)
          .plus(getWSqueethPositionValue(squeethFees))
          .plus(wethAmt.times(ethPrice))
          .plus(wethFees.times(ethPrice))

        return {
          ...position,
          amount0: new BigNumber(uniPosition.amount0.toSignificant(18)),
          amount1: new BigNumber(uniPosition.amount1.toSignificant(18)),
          fees0: toTokenAmount(fees?.amount0, 18),
          fees1: toTokenAmount(fees?.amount1, 18),
          dollarValue,
        }
      }) || []
    )
  }, [
    data?.positions,
    pool,
    ethPrice.toString(),
    squeethInitialPrice.toNumber(),
    ethPrice.toNumber(),
    data?.positions?.length,
  ])

  useEffect(() => {
    if (positionAndFees) {
      Promise.all(positionAndFees).then((values) => {
        setActivePositions(values.filter((p) => p.amount0.gt(0) || p.amount1.gt(0)))
        setClosedPositions(values.filter((p) => p.amount0.isZero() && p.amount1.isZero()))
        setLoading(false)
      })
    }
  }, [positionAndFees.length])

  return {
    activePositions: activePositions,
    closedPositions: closedPositions,
    loading: gphLoading || loading,
    refetch,
  }
}

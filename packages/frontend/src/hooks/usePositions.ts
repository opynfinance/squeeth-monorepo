import { useQuery } from '@apollo/client'
import { Position } from '@uniswap/v3-sdk'
import BigNumber from 'bignumber.js'
import { useCallback, useEffect, useMemo, useState } from 'react'

import NFTpositionManagerABI from '../abis/NFTpositionmanager.json'
import { useWallet } from '@context/wallet'
import { useWorldContext } from '@context/world'
import { TransactionType } from '@constants/enums'
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
import useInterval from './useInterval'
import { useUsdAmount } from './useUsdAmount'
import { useTransactionHistory } from './useTransactionHistory'

const bigZero = new BigNumber(0)

export const usePositions = () => {
  const { squeethPool, weth, oSqueeth, shortHelper, swapRouter } = useAddresses()
  const { address } = useWallet()
  const { getUsdAmt } = useUsdAmount()
  const { getDebtAmount, normFactor: normalizationFactor } = useController()
  const { oSqueethBal } = useWorldContext()

  const [positionType, setPositionType] = useState(PositionType.NONE)

  const { data, loading, refetch } = useQuery<swaps, swapsVariables>(SWAPS_QUERY, {
    variables: {
      poolAddress: squeethPool?.toLowerCase(),
      origin: address || '',
      recipients: [shortHelper, address || '', swapRouter],
      orderDirection: 'asc',
    },
    fetchPolicy: 'cache-and-network',
  })

  useInterval(refetch, 30000)

  const { vaults: shortVaults } = useVaultManager(5)
  const [existingCollatPercent, setExistingCollatPercent] = useState(0)
  const [existingCollat, setExistingCollat] = useState(new BigNumber(0))
  const [liquidationPrice, setLiquidationPrice] = useState(new BigNumber(0))
  const [isMintedBal, setIsMintedBal] = useState(false)
  const [firstValidVault, setFirstValidVault] = useState(0)
  const [positionLoading, setPositionLoading] = useState(true)
  const { depositedSqueeth, withdrawnSqueeth, squeethLiquidity, wethLiquidity, loading: lpLoading } = useLPPositions()

  const swaps = data?.swaps
  const isWethToken0 = parseInt(weth, 16) < parseInt(oSqueeth, 16)
  const vaultId = shortVaults[firstValidVault]?.id || 0

  useEffect(() => {
    if (loading || lpLoading) {
      setPositionLoading(true)
    }
  }, [lpLoading])

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

  const mintedDebt = useMemo(() => {
    return oSqueethBal?.isGreaterThan(0) && positionType === PositionType.LONG
      ? oSqueethBal.minus(squeethAmount)
      : oSqueethBal
  }, [oSqueethBal.toString(), positionType, squeethAmount.toString()])

  const shortDebt = useMemo(() => {
    return positionType === PositionType.SHORT ? squeethAmount : new BigNumber(0)
  }, [positionType, squeethAmount.toString()])

  const longSqthBal = useMemo(() => {
    return mintedDebt.gt(0) ? oSqueethBal.minus(mintedDebt) : oSqueethBal
  }, [positionType, oSqueethBal.toString(), mintedDebt.toString()])

  const lpDebt = useMemo(() => {
    return depositedSqueeth.minus(withdrawnSqueeth).isGreaterThan(0)
      ? depositedSqueeth.minus(withdrawnSqueeth)
      : new BigNumber(0)
  }, [positionType, depositedSqueeth.toString(), withdrawnSqueeth.toString()])

  const { finalSqueeth, finalWeth } = useMemo(() => {
    // dont include LPed amount will be the correct short amount
    const finalSqueeth = squeethAmount
    const finalWeth = wethAmount.div(squeethAmount).multipliedBy(finalSqueeth)
    setPositionLoading(false)
    return { finalSqueeth, finalWeth }
  }, [squeethAmount.toString(), wethAmount.toString()])

  useEffect(() => {
    if (finalSqueeth.isGreaterThan(0)) {
      setPositionType(PositionType.LONG)
    } else if (finalSqueeth.isLessThan(0)) {
      setPositionType(PositionType.SHORT)
    } else setPositionType(PositionType.NONE)
  }, [finalSqueeth.toString()])

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
          setLiquidationPrice(_collat.div(rSqueeth.multipliedBy(1.5)))
        } else {
          setIsMintedBal(false)
        }
      })
    } else {
      setIsMintedBal(false)
    }
  }, [squeethAmount.toString(), shortVaults.length])

  return {
    swaps,
    loading: lpLoading,
    squeethAmount: finalSqueeth.absoluteValue(),
    shortDebt: shortDebt.absoluteValue(),
    lpedSqueeth: lpDebt,
    mintedDebt: mintedDebt,
    longSqthBal: longSqthBal,
    wethAmount: finalWeth,
    shortVaults,
    refetch,
    positionType,
    existingCollatPercent,
    existingCollat,
    liquidationPrice,
    isMintedBal,
    firstValidVault,
    vaultId,
    isLong: positionType === PositionType.LONG,
    isShort: positionType === PositionType.SHORT,
    isLP: squeethLiquidity.gt(0) || wethLiquidity.gt(0),
  }
}

const useLongPositions = () => {
  const { squeethPool, weth, oSqueeth, swapRouter } = useAddresses()
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

  useInterval(refetch, 15000)

  const swaps = data?.swaps
  const isWethToken0 = parseInt(weth, 16) < parseInt(oSqueeth, 16)

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
          // when the position is fully closed, reset values to zero
          if (acc.squeethAmount.isZero()) {
            acc.usdAmount = bigZero
            acc.wethAmount = bigZero
            acc.realizedSqueeth = bigZero
            acc.realizedETH = bigZero
            acc.realizedUSD = bigZero
          } else {
            // when the position is partially closed, will accumulate usdamount
            acc.usdAmount = acc.usdAmount.plus(usdAmt)
            acc.wethAmount = acc.wethAmount.plus(wethAmt.negated())
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
  }, [realizedSqueeth.toString(), realizedUSD.toString()])

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

const useShortPositions = () => {
  const { squeethPool, weth, oSqueeth, shortHelper } = useAddresses()
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

  useInterval(refetch, 15000)

  const { vaults: shortVaults } = useVaultManager(5)
  const { getDebtAmount, normFactor: normalizationFactor } = useController()

  const [existingCollatPercent, setExistingCollatPercent] = useState(0)
  const [existingCollat, setExistingCollat] = useState(new BigNumber(0))
  const [liquidationPrice, setLiquidationPrice] = useState(new BigNumber(0))
  const [isMintedBal, setIsMintedBal] = useState(false)
  const [firstValidVault, setFirstValidVault] = useState(0)

  const swaps = data?.swaps
  const isWethToken0 = parseInt(weth, 16) < parseInt(oSqueeth, 16)
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
          if (squeethAmt.isPositive()) {
            acc.totalSqueeth = acc.totalSqueeth.plus(squeethAmt.abs())
            acc.totalETH = acc.totalETH.plus(wethAmt.abs())
            acc.totalUSDReceived = acc.totalUSDReceived.plus(usdAmt.abs())
          } else if (squeethAmt.isNegative()) {
            acc.realizedSqueeth = acc.realizedSqueeth.plus(squeethAmt.abs())
            acc.realizedETH = acc.realizedETH.plus(wethAmt.abs())
            acc.realizedUSD = acc.realizedUSD.plus(usdAmt.abs())
          }
          // when the position is fully closed, reset values to zero
          if (acc.squeethAmount.isZero()) {
            acc.usdAmount = bigZero
            acc.wethAmount = bigZero
            acc.realizedSqueeth = bigZero
            acc.realizedETH = bigZero
            acc.realizedUSD = bigZero
            // when the position is partially closed, will accumulate usdamount
          } else {
            acc.wethAmount = acc.wethAmount.plus(wethAmt.negated())
            acc.usdAmount = acc.usdAmount.plus(usdAmt.negated())
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
          setLiquidationPrice(_collat.div(rSqueeth.multipliedBy(1.5)))
        } else {
          setIsMintedBal(false)
        }
      })
    } else {
      setIsMintedBal(false)
    }
  }, [squeethAmount.toString(), shortVaults.length])

  const { realizedPNL } = useMemo(() => {
    if (!realizedSqueeth.gt(0)) return { realizedPNL: bigZero }

    const costForOneSqth = totalUSDReceived.div(totalSqueeth)
    const realizedForOneSqth = realizedUSD.div(realizedSqueeth)
    const pnlForOneSqth = realizedForOneSqth.minus(costForOneSqth)

    return { realizedPNL: pnlForOneSqth.multipliedBy(realizedSqueeth) }
  }, [realizedSqueeth.toString(), realizedUSD.toString()])

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
  const { usdAmount: shortUsdAmt, realizedPNL: shortRealizedPNL, refetch: refetchShort } = useShortPositions()
  const { positionType, squeethAmount, wethAmount, shortVaults, loading: positionLoading } = usePositions()
  const { ethPrice } = useWorldContext()
  const { ready, getSellQuote, getBuyQuote } = useSqueethPool()
  const { swapTransactions: transactions } = useTransactionHistory()
  const { index } = useController()

  const [sellQuote, setSellQuote] = useState({
    amountOut: new BigNumber(0),
    minimumAmountOut: new BigNumber(0),
    priceImpact: '0',
  })
  const [buyQuote, setBuyQuote] = useState(new BigNumber(0))
  const [longGain, setLongGain] = useState(new BigNumber(0))
  const [shortGain, setShortGain] = useState(new BigNumber(0))
  const [loading, setLoading] = useState(true)

  const refetch = () => {
    refetchLong()
    refetchShort()
  }

  useEffect(() => {
    if (!ready || positionLoading) return

    const p1 = getSellQuote(squeethAmount).then(setSellQuote)
    const p2 = getBuyQuote(squeethAmount).then((val) => setBuyQuote(val.amountIn))
    Promise.all([p1, p2]).then(() => setLoading(false))
  }, [ready, squeethAmount.toString(), shortVaults?.length, positionLoading])

  useEffect(() => {
    if (sellQuote.amountOut.isZero() && !loading) {
      setLongGain(new BigNumber(0))
      return
    }
    const _currentValue = sellQuote.amountOut.times(100).div(wethAmount.absoluteValue())
    const _gain = _currentValue.minus(100)
    setLongGain(_gain)
  }, [ethPrice.toString(), wethAmount.toString(), sellQuote.amountOut.toString(), squeethAmount.toString()])

  useEffect(() => {
    if (squeethAmount.isZero()) {
      setLongGain(new BigNumber(0))
      return
    }
    const _currentValue = buyQuote.div(wethAmount.absoluteValue()).times(100)
    const _gain = new BigNumber(100).minus(_currentValue)
    setShortGain(_gain)
  }, [buyQuote.toString(), ethPrice.toString(), wethAmount.toString(), squeethAmount.toString()])

  const currentShortDeposits = useMemo(() => {
    if (positionType === PositionType.LONG) return []
    let totalShortSqth = new BigNumber(0)
    const result = []
    for (let index = 0; index < transactions.length; index++) {
      if (totalShortSqth.gte(squeethAmount)) break
      if (
        totalShortSqth.isLessThan(squeethAmount) &&
        transactions[index].transactionType === TransactionType.MINT_SHORT
      ) {
        totalShortSqth = totalShortSqth.plus(transactions[index].squeethAmount)
        result.push(transactions[index])
      } else if (
        totalShortSqth.isLessThan(squeethAmount) &&
        transactions[index].transactionType === TransactionType.BURN_SHORT
      ) {
        totalShortSqth = totalShortSqth.minus(transactions[index].squeethAmount)
      }
    }
    return result
  }, [positionType, squeethAmount.toString(), transactions.length])

  const { shortUnrealizedPNL } = useMemo(
    () =>
      currentShortDeposits.reduce(
        (acc, curr) => {
          acc.shortUnrealizedPNL = acc.shortUnrealizedPNL.plus(
            wethAmount
              .minus(buyQuote)
              .times(toTokenAmount(index, 18).sqrt())
              .plus(curr?.ethAmount.times(curr?.ethPriceAtDeposit.minus(ethPrice))),
          )
          return acc
        },
        {
          shortUnrealizedPNL: new BigNumber(0),
        },
      ),
    [buyQuote.toString(), currentShortDeposits.length, ethPrice.toString(), wethAmount.toString()],
  )

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
    shortUnrealizedPNL,
  }
}

export const useLPPositions = () => {
  const { address, web3 } = useWallet()
  const { squeethPool, nftManager, weth, oSqueeth } = useAddresses()
  const { pool, getWSqueethPositionValue, squeethInitialPrice } = useSqueethPool()
  const { ethPrice } = useWorldContext()

  const [activePositions, setActivePositions] = useState<NFTManagers[]>([])
  const [closedPositions, setClosedPositions] = useState<NFTManagers[]>([])
  const [loading, setLoading] = useState(true)
  const [squeethLiquidity, setSqueethLiquidity] = useState(new BigNumber(0))
  const [wethLiquidity, setWethLiquidity] = useState(new BigNumber(0))
  const [depositedSqueeth, setDepositedSqueeth] = useState(new BigNumber(0))
  const [depositedWeth, setDepositedWeth] = useState(new BigNumber(0))
  const [withdrawnSqueeth, setWithdrawnSqueeth] = useState(new BigNumber(0))
  const [withdrawnWeth, setWithdrawnWeth] = useState(new BigNumber(0))

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

  const isWethToken0 = useMemo(() => parseInt(weth, 16) < parseInt(oSqueeth, 16), [weth, oSqueeth])

  const positionAndFees = useMemo(() => {
    if (!pool || !squeethInitialPrice.toNumber() || !ethPrice.toNumber()) return []
    return (
      data?.positions.map(async (p) => {
        const position = { ...p }
        const tokenIdHexString = new BigNumber(position.id).toString()
        const uniPosition = new Position({
          pool,
          liquidity: position.liquidity.toString(),
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
    squeethInitialPrice.toString(),
    ethPrice.toString(),
    data?.positions?.length,
  ])

  useEffect(() => {
    if (positionAndFees && !gphLoading) {
      setLoading(true)
      Promise.all(positionAndFees).then((values) => {
        setActivePositions(values.filter((p) => p.amount0.gt(0) || p.amount1.gt(0)))
        setClosedPositions(values.filter((p) => p.amount0.isZero() && p.amount1.isZero()))
        // Calculate cumulative LP position here
        let depSqth = new BigNumber(0)
        let depWeth = new BigNumber(0)
        let withSqth = new BigNumber(0)
        let withWeth = new BigNumber(0)
        let sqthLiq = new BigNumber(0)
        let wethLiq = new BigNumber(0)
        for (const position of values) {
          sqthLiq = sqthLiq.plus(isWethToken0 ? position.amount1 : position.amount0)
          wethLiq = wethLiq.plus(isWethToken0 ? position.amount0 : position.amount1)
          depSqth = depSqth.plus(isWethToken0 ? position.depositedToken1 : position.depositedToken0)
          depWeth = depWeth.plus(isWethToken0 ? position.depositedToken0 : position.depositedToken1)
          withSqth = withSqth.plus(
            isWethToken0
              ? new BigNumber(position.withdrawnToken1).plus(position.collectedFeesToken1)
              : new BigNumber(position.withdrawnToken0).plus(position.collectedFeesToken0),
          )
          withWeth = withWeth.plus(
            !isWethToken0
              ? new BigNumber(position.withdrawnToken1).plus(position.collectedFeesToken1)
              : new BigNumber(position.withdrawnToken0).plus(position.collectedFeesToken0),
          )
        }

        setDepositedSqueeth(depSqth)
        setDepositedWeth(depWeth)
        setWithdrawnSqueeth(withSqth)
        setWithdrawnWeth(withWeth)
        setSqueethLiquidity(sqthLiq)
        setWethLiquidity(wethLiq)
        if (
          !(
            depSqth.isEqualTo(0) &&
            depWeth.isEqualTo(0) &&
            withSqth.isEqualTo(0) &&
            sqthLiq.isEqualTo(0) &&
            wethLiq.isEqualTo(0)
          ) ||
          activePositions.length === 0
        )
          setLoading(false)
      })
    }
  }, [gphLoading, isWethToken0, data?.positions, positionAndFees.length])

  return {
    activePositions: activePositions,
    closedPositions: closedPositions,
    loading: loading,
    depositedSqueeth,
    depositedWeth,
    withdrawnSqueeth,
    withdrawnWeth,
    squeethLiquidity,
    wethLiquidity,
    refetch,
  }
}

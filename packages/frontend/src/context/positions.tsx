import React, { useContext, useState, useCallback, useEffect, useMemo } from 'react'
import BigNumber from 'bignumber.js'
import { useQuery } from '@apollo/client'

import { useWallet } from '@context/wallet'
import { useWorldContext } from '@context/world'
import { useAddresses } from '../hooks/useAddress'
import { useUsdAmount } from '../hooks/useUsdAmount'
import { useController } from '../hooks/contracts/useController'
import { useVaultManager } from '../hooks/contracts/useVaultManager'
import { useLPPositions } from '../hooks/usePositions'
import { swaps, swapsVariables, swaps_swaps } from '../queries/uniswap/__generated__/swaps'
import { PositionType } from '../types'
import SWAPS_QUERY, { SWAPS_SUBSCRIPTION } from '../queries/uniswap/swapsQuery'

type positionsContextType = {
  swaps: swaps_swaps[] | undefined
  loading: boolean
  squeethAmount: BigNumber
  shortDebt: BigNumber
  lpedSqueeth: BigNumber
  mintedDebt: BigNumber
  longSqthBal: BigNumber
  wethAmount: BigNumber
  shortVaults: any[]
  refetch: () => void
  positionType: string
  existingCollatPercent: number
  existingCollat: BigNumber
  liquidationPrice: BigNumber
  isMintedBal: boolean
  firstValidVault: number
  vaultId: any
  isLong: boolean
  isShort: boolean
  isLP: boolean
}

const initialState: positionsContextType = {
  swaps: [],
  loading: false,
  squeethAmount: new BigNumber(0),
  shortDebt: new BigNumber(0),
  lpedSqueeth: new BigNumber(0),
  mintedDebt: new BigNumber(0),
  longSqthBal: new BigNumber(0),
  wethAmount: new BigNumber(0),
  shortVaults: [],
  refetch: () => null,
  positionType: PositionType.NONE,
  existingCollatPercent: 0,
  existingCollat: new BigNumber(0),
  liquidationPrice: new BigNumber(0),
  isMintedBal: false,
  firstValidVault: 0,
  vaultId: null,
  isLong: false,
  isShort: false,
  isLP: false,
}

const positionsContext = React.createContext<positionsContextType>(initialState)
const usePositions = () => useContext(positionsContext)

const bigZero = new BigNumber(0)
const PositionsProvider: React.FC = ({ children }) => {
  const { squeethPool, weth, oSqueeth, shortHelper, swapRouter } = useAddresses()
  const { address } = useWallet()
  const { getUsdAmt } = useUsdAmount()
  const { getDebtAmount, normFactor: normalizationFactor } = useController()
  const { oSqueethBal } = useWorldContext()
  const { vaults: shortVaults } = useVaultManager()

  const { data, subscribeToMore, refetch } = useQuery<swaps, swapsVariables>(SWAPS_QUERY, {
    variables: {
      poolAddress: squeethPool?.toLowerCase(),
      origin: address || '',
      recipients: [shortHelper, address || '', swapRouter],
      orderDirection: 'asc',
    },
    fetchPolicy: 'cache-and-network',
  })

  useEffect(() => {
    subscribeToNewPositions()
  }, [])

  const subscribeToNewPositions = useCallback(() => {
    subscribeToMore({
      document: SWAPS_SUBSCRIPTION,
      variables: {
        poolAddress: squeethPool?.toLowerCase(),
        origin: address || '',
        recipients: [shortHelper, address || '', swapRouter],
        orderDirection: 'asc',
      },
      updateQuery(prev, { subscriptionData }) {
        if (!subscriptionData.data) return prev
        const newSwaps = subscriptionData.data.swaps
        return {
          swaps: newSwaps,
        }
      },
    })
  }, [address, shortHelper, squeethPool, subscribeToMore, swapRouter])

  const [positionType, setPositionType] = useState(PositionType.NONE)
  const [existingCollatPercent, setExistingCollatPercent] = useState(0)
  const [existingCollat, setExistingCollat] = useState(new BigNumber(0))
  const [liquidationPrice, setLiquidationPrice] = useState(new BigNumber(0))
  const [isMintedBal, setIsMintedBal] = useState(false)
  const [firstValidVault, setFirstValidVault] = useState(0)
  const { depositedSqueeth, withdrawnSqueeth, squeethLiquidity, wethLiquidity, loading: lpLoading } = useLPPositions()

  const swaps = data?.swaps
  const isWethToken0 = parseInt(weth, 16) < parseInt(oSqueeth, 16)
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
    [isWethToken0, swaps?.length],
  )

  const mintedDebt = useMemo(() => {
    // squeethAmount = user long balance if oSqueethBal > 0, but it could also be minted balance
    return shortVaults[firstValidVault]?.shortAmount.gt(0) &&
      oSqueethBal?.isGreaterThan(0) &&
      positionType === PositionType.LONG
      ? oSqueethBal.minus(squeethAmount)
      : shortVaults[firstValidVault]?.shortAmount.gt(0) && oSqueethBal?.isGreaterThan(0)
      ? oSqueethBal
      : new BigNumber(0)
  }, [firstValidVault, oSqueethBal.toString(), positionType, shortVaults?.length, squeethAmount.toString()])

  const shortDebt = useMemo(() => {
    return positionType === PositionType.SHORT ? squeethAmount : new BigNumber(0)
  }, [positionType, squeethAmount.toString()])

  const longSqthBal = useMemo(() => {
    return mintedDebt.gt(0) ? oSqueethBal.minus(mintedDebt) : oSqueethBal
  }, [oSqueethBal.toString(), mintedDebt.toString()])

  const lpDebt = useMemo(() => {
    return depositedSqueeth.minus(withdrawnSqueeth).isGreaterThan(0)
      ? depositedSqueeth.minus(withdrawnSqueeth)
      : new BigNumber(0)
  }, [depositedSqueeth.toString(), withdrawnSqueeth.toString()])

  const { finalSqueeth, finalWeth } = useMemo(() => {
    // dont include LPed & minted amount will be the correct short amount
    const finalSqueeth = squeethAmount
    const finalWeth = wethAmount.div(squeethAmount).multipliedBy(finalSqueeth)
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
  }, [shortVaults.length])

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

  const values = {
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

  return <positionsContext.Provider value={values}>{children}</positionsContext.Provider>
}

export { PositionsProvider, usePositions }

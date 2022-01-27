import React, { useContext, useState, useEffect, useMemo } from 'react'
import BigNumber from 'bignumber.js'

import { BIG_ZERO } from '@constants/index'
import { useWorldContext } from '@context/world'
import { useSwapsData } from '../hooks/useSwapsData'
import { useController } from '../hooks/contracts/useController'
import { useVaultManager } from '../hooks/contracts/useVaultManager'
import { useLPPositions } from '../hooks/usePositions'
import { swaps_swaps } from '../queries/uniswap/__generated__/swaps'
import { NFTManagers, PositionType } from '../types'

type positionsContextType = {
  activePositions: NFTManagers[]
  closedPositions: NFTManagers[]
  swaps: swaps_swaps[] | undefined
  loading: boolean
  squeethAmount: BigNumber
  shortDebt: BigNumber
  lpedSqueeth: BigNumber
  mintedDebt: BigNumber
  longSqthBal: BigNumber
  wethAmount: BigNumber
  shortVaults: any[]
  swapsQueryRefetch: () => void
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
  longRealizedPNL: BigNumber
  shortRealizedPNL: BigNumber
  longUsdAmount: BigNumber
  shortUsdAmount: BigNumber
}

const positionsContext = React.createContext<positionsContextType | undefined>(undefined)

const PositionsProvider: React.FC = ({ children }) => {
  const { getDebtAmount, normFactor: normalizationFactor } = useController()
  const { oSqueethBal } = useWorldContext()
  const { vaults: shortVaults, refetch: refetchVault } = useVaultManager()
  const {
    squeethAmount,
    wethAmount,
    longRealizedSqueeth,
    totalUSDSpent,
    longRealizedUSD,
    longTotalSqueeth,
    shortRealizedSqueeth,
    shortRealizedUSD,
    totalUSDReceived,
    shortTotalSqueeth,
    longUsdAmount,
    shortUsdAmount,
    swaps,
    refetch: swapsQueryRefetch,
  } = useSwapsData()
  const {
    depositedSqueeth,
    withdrawnSqueeth,
    squeethLiquidity,
    wethLiquidity,
    loading: lpLoading,
    activePositions,
    closedPositions,
    depositedWeth,
    withdrawnWeth,
    refetch: positionsQueryRefetch,
  } = useLPPositions()

  const [positionType, setPositionType] = useState(PositionType.NONE)
  const [existingCollatPercent, setExistingCollatPercent] = useState(0)
  const [existingCollat, setExistingCollat] = useState(new BigNumber(0))
  const [liquidationPrice, setLiquidationPrice] = useState(new BigNumber(0))
  const [isMintedBal, setIsMintedBal] = useState(false)
  const [firstValidVault, setFirstValidVault] = useState(0)

  const vaultId = shortVaults[firstValidVault]?.id || 0

  const { longRealizedPNL } = useMemo(() => {
    if (!longRealizedSqueeth.gt(0)) return { longRealizedPNL: BIG_ZERO }
    const costForOneSqth = !totalUSDSpent.isEqualTo(0) ? totalUSDSpent.div(longTotalSqueeth) : BIG_ZERO
    const realizedForOneSqth = !longRealizedUSD.isEqualTo(0) ? longRealizedUSD.div(longRealizedSqueeth) : BIG_ZERO
    const pnlForOneSqth = realizedForOneSqth.minus(costForOneSqth)

    return {
      longRealizedPNL: pnlForOneSqth.multipliedBy(longRealizedSqueeth),
    }
  }, [
    longRealizedSqueeth.toString(),
    longRealizedUSD.toString(),
    longTotalSqueeth.toString(),
    totalUSDSpent.toString(),
  ])

  const { shortRealizedPNL } = useMemo(() => {
    if (!shortRealizedSqueeth.gt(0)) return { shortRealizedPNL: BIG_ZERO }

    const costForOneSqth = !totalUSDReceived.isEqualTo(0) ? totalUSDReceived.div(shortTotalSqueeth) : BIG_ZERO
    const realizedForOneSqth = !shortRealizedUSD.isEqualTo(0) ? shortRealizedUSD.div(shortRealizedSqueeth) : BIG_ZERO
    const pnlForOneSqth = realizedForOneSqth.minus(costForOneSqth)

    return { shortRealizedPNL: pnlForOneSqth.multipliedBy(shortRealizedSqueeth) }
  }, [
    shortRealizedSqueeth.toString(),
    shortRealizedUSD.toString(),
    shortTotalSqueeth.toString(),
    totalUSDReceived.toString(),
  ])

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

  useEffect(() => {
    refetchVault()
  }, [squeethAmount.toString()])

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
    swapsQueryRefetch,
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
    longRealizedPNL,
    shortRealizedPNL,
    longUsdAmount,
    shortUsdAmount,
    activePositions,
    closedPositions,
    depositedWeth,
    withdrawnWeth,
    positionsQueryRefetch,
  }

  return <positionsContext.Provider value={values}>{children}</positionsContext.Provider>
}

function usePositions() {
  const context = useContext(positionsContext)
  if (context === undefined) {
    throw new Error('usePositions must be used within a PositionsProvider')
  }
  return context
}

export { PositionsProvider, usePositions }

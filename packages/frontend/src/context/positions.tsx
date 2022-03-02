import React, { useContext, useState, useEffect, useMemo } from 'react'
import BigNumber from 'bignumber.js'

import { BIG_ZERO } from '@constants/index'
import { useWorldContext } from '@context/world'
import { useSwapsData } from '../hooks/useSwapsData'
import { useVaultManager } from '../hooks/contracts/useVaultManager'
import { useLPPositions } from '../hooks/usePositions'
import { useVaultData } from '../hooks/useVaultData'
import { swaps_swaps } from '../queries/uniswap/__generated__/swaps'
import { NFTManagers, PositionType } from '../types'
import { useVaultHistory } from '@hooks/useVaultHistory'

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
  firstValidVault: number
  vaultId: any
  isLong: boolean
  isShort: boolean
  isLP: boolean
  longRealizedPNL: BigNumber
  shortRealizedPNL: BigNumber
  shortUsdAmount: BigNumber
  isWethToken0: boolean
  totalUSDFromBuy: BigNumber
  totalUSDFromSell: BigNumber
}

const positionsContext = React.createContext<positionsContextType | undefined>(undefined)

const PositionsProvider: React.FC = ({ children }) => {
  const { oSqueethBal } = useWorldContext()
  const { vaults: shortVaults, vaultId } = useVaultManager()
  const {
    squeethAmount,
    wethAmount,
    totalUSDFromBuy,
    boughtSqueeth,
    totalUSDFromSell,
    soldSqueeth,
    shortUsdAmount,
    swaps,
    refetch: swapsQueryRefetch,
    isWethToken0,
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

  const { mintedSqueeth, openShortSqueeth } = useVaultHistory()

  const [positionType, setPositionType] = useState(PositionType.NONE)
  const [firstValidVault, setFirstValidVault] = useState(0)

  const { existingCollat, existingCollatPercent, existingLiqPrice: liquidationPrice } = useVaultData(vaultId)

  const { longRealizedPNL } = useMemo(() => {
    if (!soldSqueeth.gt(0)) return { longRealizedPNL: BIG_ZERO }
    const costForOneSqth = !totalUSDFromBuy.isEqualTo(0) ? totalUSDFromBuy.div(boughtSqueeth) : BIG_ZERO
    const realizedForOneSqth = !totalUSDFromSell.isEqualTo(0) ? totalUSDFromSell.div(soldSqueeth) : BIG_ZERO
    const pnlForOneSqth = realizedForOneSqth.minus(costForOneSqth)

    return {
      longRealizedPNL: pnlForOneSqth.multipliedBy(soldSqueeth),
    }
  }, [soldSqueeth.toString(), totalUSDFromSell.toString(), boughtSqueeth.toString(), totalUSDFromBuy.toString()])

  const { shortRealizedPNL } = useMemo(() => {
    if (!boughtSqueeth.gt(0)) return { shortRealizedPNL: BIG_ZERO }

    const costForOneSqth = !totalUSDFromSell.isEqualTo(0) ? totalUSDFromSell.div(soldSqueeth) : BIG_ZERO
    const realizedForOneSqth = !totalUSDFromBuy.isEqualTo(0) ? totalUSDFromBuy.div(boughtSqueeth) : BIG_ZERO
    const pnlForOneSqth = realizedForOneSqth.minus(costForOneSqth)

    return { shortRealizedPNL: pnlForOneSqth.multipliedBy(boughtSqueeth) }
  }, [boughtSqueeth.toString(), totalUSDFromBuy.toString(), soldSqueeth.toString(), totalUSDFromSell.toString()])

  //when the squeethAmount < 0 and the abs amount is greater than openShortSqueeth, that means there is manually sold short position
  const mintedSoldShort = useMemo(() => {
    return positionType === PositionType.SHORT && squeethAmount.abs().isGreaterThan(openShortSqueeth)
      ? squeethAmount.abs().minus(openShortSqueeth)
      : new BigNumber(0)
  }, [positionType, squeethAmount?.toString(), openShortSqueeth.toString()])

  const lpDebt = useMemo(() => {
    return depositedSqueeth.minus(withdrawnSqueeth).isGreaterThan(0)
      ? depositedSqueeth.minus(withdrawnSqueeth)
      : new BigNumber(0)
  }, [depositedSqueeth.toString(), withdrawnSqueeth.toString()])

  //mintedSqueeth balance from vault histroy - mintedSold short position = existing mintedDebt in vault, but
  //LPed amount wont be taken into account from vault history, so will need to be deducted here and added the withdrawn amount back
  const mintedDebt = useMemo(() => {
    return mintedSqueeth.minus(mintedSoldShort).minus(depositedSqueeth).plus(withdrawnSqueeth)
  }, [mintedSqueeth.toString(), mintedSoldShort?.toString(), depositedSqueeth.toString(), withdrawnSqueeth.toString()])

  useEffect(() => {
    if (squeethAmount.isGreaterThan(0)) {
      setPositionType(PositionType.LONG)
    } else if (squeethAmount.isLessThan(0)) {
      setPositionType(PositionType.SHORT)
    } else setPositionType(PositionType.NONE)
  }, [squeethAmount.toString()])

  useEffect(() => {
    for (let i = 0; i < shortVaults.length; i++) {
      if (shortVaults[i]?.collateralAmount.isGreaterThan(0)) {
        setFirstValidVault(i)
      }
    }
  }, [shortVaults.length])

  const values = {
    swaps,
    loading: lpLoading,
    squeethAmount: squeethAmount.absoluteValue(),
    shortDebt: positionType === PositionType.SHORT ? squeethAmount.absoluteValue() : new BigNumber(0),
    lpedSqueeth: lpDebt,
    mintedDebt: mintedDebt,
    longSqthBal: positionType === PositionType.LONG ? squeethAmount : new BigNumber(0),
    wethAmount: wethAmount,
    shortVaults,
    swapsQueryRefetch,
    positionType,
    existingCollatPercent,
    existingCollat,
    liquidationPrice,
    firstValidVault,
    vaultId,
    isLong: positionType === PositionType.LONG,
    isShort: positionType === PositionType.SHORT,
    isLP: squeethLiquidity.gt(0) || wethLiquidity.gt(0),
    longRealizedPNL,
    shortRealizedPNL,
    shortUsdAmount,
    activePositions,
    closedPositions,
    depositedWeth,
    withdrawnWeth,
    positionsQueryRefetch,
    isWethToken0,
    totalUSDFromBuy,
    totalUSDFromSell,
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

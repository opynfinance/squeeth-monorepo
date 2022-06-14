import BigNumber from 'bignumber.js'
import { calculatePnL } from 'src/lib'
import { PositionType } from 'types/global_apollo'
import useAccounts from './useAccounts'
import useCurrentPrices from './useCurrentPrices'

export default function usePositionNPnL() {
  const { ethPrice, oSqthPrice, loading: isCurrentPriceLoading } = useCurrentPrices()
  const { positions, lpPosition, positionType, loading: isPositionsLoading } = useAccounts()


  const {
    currentPositionValue,
    currentETHAmount,
    currentOSQTHAmount,
    unrealizedPnL,
    unrealizedPnLInPerct,
    realizedPnL,
    realizedPnLInPerct,
  } = calculatePnL(positions, oSqthPrice, ethPrice)
  const {
    unrealizedPnL: lpUnrealizedPnL,
    unrealizedPnLInPerct: lpUnrealizedPnLInPerct,
    realizedPnL: lpRealizedPnL,
    realizedPnLInPerct: lpRealizedPnLInPerct,
  } = calculatePnL(lpPosition, oSqthPrice, ethPrice)

  return {
    currentPositionValue,
    currentETHAmount,
    currentOSQTHAmount,
    positionType,
    loading: isCurrentPriceLoading || isPositionsLoading,
    unrealizedPnL,
    unrealizedPnLInPerct,
    realizedPnL,
    realizedPnLInPerct,
    lpUnrealizedPnL,
    lpUnrealizedPnLInPerct,
    lpRealizedPnL,
    lpRealizedPnLInPerct,
  }
}

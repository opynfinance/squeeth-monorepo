import { PositionType } from '../types/index'
import { calculatePnL } from 'src/lib'
import useAccounts from './useAccounts'
import useCurrentPrices from './useCurrentPrices'

export default function usePositionNPnL() {
  const { ethPrice, oSqthPrice, loading: isCurrentPriceLoading } = useCurrentPrices()
  const { positions, lpPosition, loading: isPositionsLoading, accShortAmount } = useAccounts()
  let positionType = PositionType.NONE

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
    currentOSQTHAmount: lpedoSQTHAmount,
    currentETHAmount: lpedETHAmount,
    unrealizedPnL: lpUnrealizedPnL,
    unrealizedPnLInPerct: lpUnrealizedPnLInPerct,
    realizedPnL: lpRealizedPnL,
    realizedPnLInPerct: lpRealizedPnLInPerct,
  } = calculatePnL(lpPosition, oSqthPrice, ethPrice)

  if (currentOSQTHAmount.gt(accShortAmount)) {
    positionType = PositionType.LONG
  } else if (currentOSQTHAmount.lt(accShortAmount)) {
    positionType = PositionType.SHORT
  } else {
    positionType = PositionType.NONE
  }

  return {
    currentPositionValue,
    currentETHAmount,
    currentOSQTHAmount: currentOSQTHAmount.abs(),
    positionType,
    loading: isCurrentPriceLoading || isPositionsLoading,
    unrealizedPnL,
    unrealizedPnLInPerct,
    realizedPnL,
    realizedPnLInPerct,
    lpedoSQTHAmount,
    lpedETHAmount,
    lpUnrealizedPnL,
    lpUnrealizedPnLInPerct,
    lpRealizedPnL,
    lpRealizedPnLInPerct,
  }
}

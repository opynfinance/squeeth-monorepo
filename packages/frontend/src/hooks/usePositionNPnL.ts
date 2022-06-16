import { PositionType } from '../types/index'
import { calculatePnL } from 'src/lib'
import useAccounts from './useAccounts'
import useCurrentPrices from './useCurrentPrices'
import useAppEffect from './useAppEffect'
import { positionTypeAtom } from '../state/positions/atoms'
import { useAtom } from 'jotai'

export default function usePositionNPnL() {
  const { ethPrice, oSqthPrice, loading: isCurrentPriceLoading } = useCurrentPrices()
  const { positions, lpPosition, loading: isPositionsLoading, accShortAmount } = useAccounts()
  const [positionType, setPositionType] = useAtom(positionTypeAtom)

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

  useAppEffect(() => {
    if (currentOSQTHAmount.gt(accShortAmount)) {
      setPositionType(PositionType.LONG)
    } else if (currentOSQTHAmount.lt(accShortAmount)) {
      setPositionType(PositionType.SHORT)
    } else {
      setPositionType(PositionType.NONE)
    }
  }, [currentOSQTHAmount, accShortAmount, setPositionType])

  return {
    currentPositionValue,
    currentETHAmount,
    currentOSQTHAmount: currentOSQTHAmount.abs(),
    positionType: positionType,
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

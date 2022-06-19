import { PositionType } from '../types/index'
import { calculatePnL } from 'src/lib'
import useAccounts from './useAccounts'
import useCurrentPrices from './useCurrentPrices'
import useAppEffect from './useAppEffect'
import { lpPositionAtom, positionAtom, positionTypeAtom } from '../state/positions/atoms'
import { useAtom } from 'jotai'

export default function usePositionNPnL() {
  const { ethPrice, oSqthPrice, loading: isCurrentPriceLoading } = useCurrentPrices()
  const { positions, lpPositions, loading: isPositionsLoading, accShortAmount, refetch } = useAccounts()
  const [positionType, setPositionType] = useAtom(positionTypeAtom)
  const [position, setPosition] = useAtom(positionAtom)
  const [lpPosition, setLPPosition] = useAtom(lpPositionAtom)

  useAppEffect(() => {
    const {
      currentPositionValue,
      currentETHAmount,
      currentOSQTHAmount,
      unrealizedPnL,
      unrealizedPnLInPerct,
      realizedPnL,
      realizedPnLInPerct,
    } = calculatePnL(positions, oSqthPrice, ethPrice)
    setPosition({
      currentPositionValue,
      currentETHAmount,
      currentOSQTHAmount,
      unrealizedPnL,
      unrealizedPnLInPerct,
      realizedPnL,
      realizedPnLInPerct,
    })
  }, [positions, oSqthPrice, ethPrice, setPosition])

  useAppEffect(() => {
    const {
      currentPositionValue: lpedPositionValue,
      currentOSQTHAmount: lpedoSQTHAmount,
      currentETHAmount: lpedETHAmount,
      unrealizedPnL: lpUnrealizedPnL,
      unrealizedPnLInPerct: lpUnrealizedPnLInPerct,
      realizedPnL: lpRealizedPnL,
      realizedPnLInPerct: lpRealizedPnLInPerct,
    } = calculatePnL(lpPositions, oSqthPrice, ethPrice)
    setLPPosition({
      lpedPositionValue,
      lpedETHAmount,
      lpedoSQTHAmount,
      lpUnrealizedPnL,
      lpUnrealizedPnLInPerct,
      lpRealizedPnL,
      lpRealizedPnLInPerct,
    })
  }, [lpPositions, oSqthPrice, ethPrice, setLPPosition])

  useAppEffect(() => {
    if (position.currentOSQTHAmount.gt(accShortAmount)) {
      setPositionType(PositionType.LONG)
    } else if (position.currentOSQTHAmount.lt(accShortAmount)) {
      setPositionType(PositionType.SHORT)
    } else {
      setPositionType(PositionType.NONE)
    }
  }, [position?.currentOSQTHAmount, accShortAmount, setPositionType])

  return {
    currentPositionValue: position?.currentPositionValue,
    currentETHAmount: position?.currentETHAmount,
    currentOSQTHAmount: position?.currentOSQTHAmount.abs(),
    positionType: positionType,
    loading: isCurrentPriceLoading || isPositionsLoading,
    unrealizedPnL: position?.unrealizedPnL,
    unrealizedPnLInPerct: position?.unrealizedPnLInPerct,
    realizedPnL: position?.realizedPnL,
    realizedPnLInPerct: position?.realizedPnLInPerct,
    lpedPositionValue: lpPosition?.lpedPositionValue,
    lpedoSQTHAmount: lpPosition?.lpedoSQTHAmount,
    lpedETHAmount: lpPosition?.lpedETHAmount,
    lpUnrealizedPnL: lpPosition?.lpUnrealizedPnL,
    lpUnrealizedPnLInPerct: lpPosition?.lpUnrealizedPnLInPerct,
    lpRealizedPnL: lpPosition?.lpRealizedPnL,
    lpRealizedPnLInPerct: lpPosition?.lpRealizedPnLInPerct,
    refetch,
  }
}

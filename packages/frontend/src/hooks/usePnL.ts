import BigNumber from 'bignumber.js'
import useAccounts from './useAccounts'
import useCurrentPrices from './useCurrentPrices'

export default function usePnL() {
  const { ethPrice, oSqthPrice } = useCurrentPrices()
  const { positions, lpPosition } = useAccounts()

  const realizedETHAmount = new BigNumber(positions.realizedETHAmount)
  const realizedETHUnitCost = new BigNumber(positions.realizedETHUnitCost)
  const realizedETHUnitGain = new BigNumber(positions.realizedETHUnitGain)
  const realizedOSQTHAmount = new BigNumber(positions.realizedOSQTHAmount)
  const realizedOSQTHUnitCost = new BigNumber(positions.realizedOSQTHUnitCost)
  const realizedOSQTHUnitGain = new BigNumber(positions.realizedOSQTHUnitGain)
  const unrealizedETHUnitCost = new BigNumber(positions.unrealizedETHUnitCost)
  const unrealizedOSQTHUnitCost = new BigNumber(positions.unrealizedOSQTHUnitCost)
  const currentETHAmount = new BigNumber(positions.currentETHAmount)
  const currentOSQTHAmount = new BigNumber(positions.currentOSQTHAmount)

  const lpRealizedETHAmount = new BigNumber(lpPosition.realizedETHAmount)
  const lpRealizedETHUnitCost = new BigNumber(lpPosition.realizedETHUnitCost)
  const lpRealizedETHUnitGain = new BigNumber(lpPosition.realizedETHUnitGain)
  const lpRealizedOSQTHAmount = new BigNumber(lpPosition.realizedOSQTHAmount)
  const lpRealizedOSQTHUnitCost = new BigNumber(lpPosition.realizedOSQTHUnitCost)
  const lpRealizedOSQTHUnitGain = new BigNumber(lpPosition.realizedOSQTHUnitGain)
  const lpUnrealizedETHUnitCost = new BigNumber(lpPosition.unrealizedETHUnitCost)
  const lpUnrealizedOSQTHUnitCost = new BigNumber(lpPosition.unrealizedOSQTHUnitCost)
  const lpCurrentETHAmount = new BigNumber(lpPosition.currentETHAmount)
  const lpCurrentOSQTHAmount = new BigNumber(lpPosition.currentOSQTHAmount)

  const unrealizedPnL = oSqthPrice
    .times(currentOSQTHAmount)
    .plus(currentETHAmount.times(ethPrice))
    .minus(unrealizedOSQTHUnitCost.times(currentOSQTHAmount))
    .minus(unrealizedETHUnitCost.times(currentETHAmount))

  const realizedPnL = realizedETHAmount
    .times(realizedETHUnitGain.minus(realizedETHUnitCost))
    .plus(realizedOSQTHAmount.times(realizedOSQTHUnitGain.minus(realizedOSQTHUnitCost)))

  const lpUnrealizedPnL = oSqthPrice
    .times(lpCurrentOSQTHAmount)
    .plus(lpCurrentETHAmount.times(ethPrice))
    .minus(lpUnrealizedOSQTHUnitCost.times(lpCurrentOSQTHAmount))
    .minus(lpUnrealizedETHUnitCost.times(lpCurrentETHAmount))

  const lpRealizedPnL = lpRealizedETHAmount
    .times(lpRealizedETHUnitGain.minus(lpRealizedETHUnitCost))
    .plus(lpRealizedOSQTHAmount.times(lpRealizedOSQTHUnitGain.minus(lpRealizedOSQTHUnitCost)))

  return { unrealizedPnL, realizedPnL, lpRealizedPnL, lpUnrealizedPnL }
}

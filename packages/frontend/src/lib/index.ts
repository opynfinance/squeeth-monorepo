import BigNumber from 'bignumber.js'
import { accounts_accounts_lppositions, accounts_accounts_positions } from '@queries/squeeth/__generated__/accounts'

export function calculatePnL(
  positions: accounts_accounts_positions | accounts_accounts_lppositions,
  oSqthPrice: BigNumber,
  ethPrice: BigNumber,
) {
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

  const currentPositionValue = oSqthPrice.times(currentOSQTHAmount).plus(currentETHAmount.times(ethPrice))
  const unrealizedCost = unrealizedOSQTHUnitCost
    .times(currentOSQTHAmount)
    .plus(unrealizedETHUnitCost.times(currentETHAmount))
  const unrealizedPnL = currentPositionValue.minus(unrealizedCost)
  const unrealizedPnLInPerct = safeDiv(unrealizedPnL, unrealizedCost)

  const realizedGain = realizedETHAmount
    .times(realizedETHUnitGain)
    .plus(realizedOSQTHAmount.times(realizedOSQTHUnitGain))
  const realizedCost = realizedETHAmount
    .times(realizedETHUnitCost)
    .plus(realizedOSQTHAmount.times(realizedOSQTHUnitCost))
  const realizedPnL = realizedGain.minus(realizedCost)
  const realizedPnLInPerct = safeDiv(realizedPnL, realizedCost)

  return {
    currentPositionValue,
    currentETHAmount,
    currentOSQTHAmount,
    unrealizedPnL,
    unrealizedPnLInPerct,
    realizedPnL,
    realizedPnLInPerct,
  }
}

function safeDiv(num: BigNumber, denom: BigNumber): BigNumber {
  if (denom.eq(0)) return new BigNumber(0)
  return num.div(denom)
}

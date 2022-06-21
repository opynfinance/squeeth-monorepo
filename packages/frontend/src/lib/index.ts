import BigNumber from 'bignumber.js'
import { accounts_accounts_lppositions, accounts_accounts_positions } from '@queries/squeeth/__generated__/accounts'
import { BIG_ZERO, OSQUEETH_DECIMALS, WETH_DECIMALS } from '@constants/index'
import { toTokenAmount } from '@utils/calculations'

export function pnl(currentValue: BigNumber, cost: BigNumber): BigNumber {
  return currentValue.minus(cost)
}

export function pnlInPerct(currentValue: BigNumber, cost: BigNumber): BigNumber {
  if (cost.isEqualTo(0)) return BIG_ZERO
  return currentValue.dividedBy(cost).minus(1).times(100)
}

export function calculatePnL(
  accShortAmount: BigNumber,
  positions: accounts_accounts_positions | accounts_accounts_lppositions,
  oSqthPrice: BigNumber,
  ethPrice: BigNumber,
) {
  const realizedETHAmount = toTokenAmount(positions?.realizedETHAmount, OSQUEETH_DECIMALS)
  const realizedETHUnitCost = new BigNumber(positions?.realizedETHUnitCost)
  const realizedETHUnitGain = new BigNumber(positions?.realizedETHUnitGain)
  const realizedOSQTHAmount = toTokenAmount(positions?.realizedOSQTHAmount, WETH_DECIMALS)
  const realizedOSQTHUnitCost = new BigNumber(positions?.realizedOSQTHUnitCost)
  const realizedOSQTHUnitGain = new BigNumber(positions?.realizedOSQTHUnitGain)
  const unrealizedETHUnitCost = new BigNumber(positions?.unrealizedETHUnitCost)
  const unrealizedOSQTHUnitCost = new BigNumber(positions?.unrealizedOSQTHUnitCost)
  const currentETHAmount = toTokenAmount(positions?.currentETHAmount, WETH_DECIMALS)
  const currentOSQTHAmount = new BigNumber(positions?.currentOSQTHAmount).abs()

  const currentPositionValue = oSqthPrice.times(currentOSQTHAmount).plus(currentETHAmount.times(ethPrice))
  const unrealizedCost = unrealizedOSQTHUnitCost
    .times(currentOSQTHAmount)
    .plus(unrealizedETHUnitCost.times(currentETHAmount))

  // long: close - open, short: open - close
  const unrealizedPnL = currentOSQTHAmount.lt(accShortAmount)
    ? currentPositionValue.minus(unrealizedCost).negated()
    : currentPositionValue.minus(unrealizedCost)

  const unrealizedPnLInPerct = safeDiv(unrealizedPnL, unrealizedCost)

  const realizedGain = realizedETHAmount
    .times(realizedETHUnitGain)
    .plus(realizedOSQTHAmount.times(realizedOSQTHUnitGain))
  const realizedCost = realizedETHAmount
    .times(realizedETHUnitCost)
    .plus(realizedOSQTHAmount.times(realizedOSQTHUnitCost))

  // long: close - open, short: open - close
  const realizedPnL = currentOSQTHAmount.lt(accShortAmount)
    ? realizedGain.minus(realizedCost).negated()
    : realizedGain.minus(realizedCost)
  const realizedPnLInPerct = safeDiv(realizedPnL, realizedCost)

  return {
    currentPositionValue,
    currentETHAmount,
    currentOSQTHAmount: new BigNumber(positions?.currentOSQTHAmount),
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

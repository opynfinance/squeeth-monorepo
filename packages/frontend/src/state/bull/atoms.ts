import { indexAtom, currentImpliedFundingAtom } from '@state/controller/atoms'
import { crabUSDValueAtom } from '@state/crab/atoms'
import BigNumber from 'bignumber.js'
import { atom } from 'jotai'

export const visibleStrategyRebalancesAtom = atom<number>(3)
export const bullCrabBalanceAtom = atom(new BigNumber(0))
export const bullSupplyAtom = atom(new BigNumber(0))
export const bullEulerWethCollatPerShareAtom = atom(new BigNumber(0))
export const bullEulerUsdcDebtPerShareAtom = atom(new BigNumber(0))
export const bullEthValuePerShareAtom = atom(new BigNumber(0))
export const bullCapAtom = atom(new BigNumber(0))
export const bullDepositedEthInEulerAtom = atom(new BigNumber(0))
export const bullDeltaAtom = atom(new BigNumber(0))
export const bullCRAtom = atom(new BigNumber(0))

// Positions
export const bullCurrentETHPositionAtom = atom(new BigNumber(0))
export const bullCurrentUSDCPositionAtom = atom(new BigNumber(0))

export const bullDepositedETHAtom = atom(new BigNumber(0))
export const bullDepositedUSDCAtom = atom(new BigNumber(0))

export const bullEthPnlAtom = atom(new BigNumber(0))
export const bullEthPnlPerctAtom = atom(new BigNumber(0))

export const isBullReadyAtom = atom(false)
export const bullPositionLoadedAtom = atom(false)

export const eulerUsdcBorrowRateAtom = atom(new BigNumber(0.05))
export const eulerETHLendRateAtom = atom(new BigNumber(0.1))

export const bullEulerUSDCDebtAtom = atom((get) => {
  return get(bullEulerUsdcDebtPerShareAtom).times(get(bullSupplyAtom))
})

export const bullCurrentFundingAtom = atom((get) => {
  const ethPrice = get(indexAtom).sqrt()
  const usdRate = get(eulerUsdcBorrowRateAtom)
  const ethRate = get(eulerETHLendRateAtom)
  const usdDebt = get(bullEulerUSDCDebtAtom)
  const ethCollat = get(bullDepositedEthInEulerAtom)
  const ethCollatInUsd = ethCollat.times(ethPrice)
  const dollarValueOfCrabInBull = get(bullCrabBalanceAtom).times(get(crabUSDValueAtom))

  const usdInterest = usdDebt.times(Math.exp(usdRate.div(365 / 2).toNumber())).minus(usdDebt)
  const ethInterest = ethCollatInUsd.times(Math.exp(ethRate.div(365 / 2).toNumber())).minus(ethCollatInUsd)
  const totalRate = ethInterest.minus(usdInterest)
  const interestFunding = totalRate.div(dollarValueOfCrabInBull).div(2) // Divided by 2 because we are calculating for 2 days
  const squeethFunding = get(currentImpliedFundingAtom)

  return interestFunding.plus(squeethFunding).toNumber()
})

export const bullThresholdAtom = atom((get) => {
  const funding = get(bullCurrentFundingAtom)
  if (funding < 0) return 0

  const impliedVol = Math.sqrt(funding * 365)
  return impliedVol / Math.sqrt(365 / 2)
})

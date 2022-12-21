import { BIG_ZERO, BULL_START_DATE, OSQUEETH_DECIMALS, USDC_DECIMALS } from '@constants/index'
import { indexAtom, currentImpliedFundingAtom } from '@state/controller/atoms'
import { crabUSDValueAtom } from '@state/crab/atoms'
import { toTokenAmount } from '@utils/calculations'
import { getBullChartData } from '@utils/pricer'
import BigNumber from 'bignumber.js'
import { atom, useAtomValue } from 'jotai'
import { useQuery } from 'react-query'

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
export const isBullPositionRefetchingAtom = atom(false)

export const eulerUsdcBorrowRateAtom = atom(new BigNumber(0.05))
export const eulerETHLendRateAtom = atom(new BigNumber(0.1))

export const bullEulerUSDCDebtAtom = atom(BIG_ZERO)

export const bullCurrentFundingAtom = atom((get) => {
  const ethPrice = toTokenAmount(get(indexAtom), OSQUEETH_DECIMALS).sqrt()
  const usdRate = get(eulerUsdcBorrowRateAtom)
  const ethRate = get(eulerETHLendRateAtom)
  const usdDebt = get(bullEulerUSDCDebtAtom)
  const ethCollat = get(bullDepositedEthInEulerAtom)
  const ethCollatInUsd = ethCollat.times(ethPrice)
  const dollarValueOfCrabInBull = get(bullCrabBalanceAtom).times(toTokenAmount(get(crabUSDValueAtom), 18))

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

export const bullTimeAtLastHedgeAtom = atom(0)

export const bullStrategyFilterStartDateAtom = atom<Date>(new Date(BULL_START_DATE))
export const bullStrategyFilterEndDateAtom = atom<Date>(new Date())

export const useBullPnLChartData = () => {
  const startDate = useAtomValue(bullStrategyFilterStartDateAtom)
  const endDate = useAtomValue(bullStrategyFilterEndDateAtom)

  return useQuery(
    ['pnlChart', { startDate, endDate }],
    async () =>
      getBullChartData(
        Number(startDate.valueOf().toString().slice(0, -3)),
        Number(endDate.valueOf().toString().slice(0, -3)),
      ),
    {
      staleTime: Infinity,
      refetchOnWindowFocus: true,
    },
  )
}

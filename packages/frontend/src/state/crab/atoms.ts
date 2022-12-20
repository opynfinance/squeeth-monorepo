import { atom, useAtomValue } from 'jotai'

import { BIG_ZERO, DEFAULT_SLIPPAGE } from '@constants/index'
import { Vault } from '../../types'
import { readyAtom } from '../squeethPool/atoms'
import { CRABV2_START_DATE } from '@constants/index'
import { getCrabPnlV2ChartData } from '@utils/pricer'
import { useQuery } from 'react-query'

export const maxCapAtom = atom(BIG_ZERO)
export const crabStrategyVaultAtom = atom<Vault | null>(null)
export const crabStrategyCollatRatioAtom = atom(0)
export const crabStrategyLiquidationPriceAtom = atom(BIG_ZERO)
export const timeAtLastHedgeAtom = atom(0)
export const loadingAtom = atom(true)
export const visibleStrategyHedgesAtom = atom<number>(3)

export const maxCapAtomV2 = atom(BIG_ZERO)
export const crabStrategyVaultAtomV2 = atom<Vault | null>(null)
export const crabStrategyCollatRatioAtomV2 = atom(0)
export const crabStrategyLiquidationPriceAtomV2 = atom(BIG_ZERO)
export const timeAtLastHedgeAtomV2 = atom(0)
export const loadingAtomV2 = atom(true)
export const ethPriceAtLastHedgeAtomV2 = atom(BIG_ZERO)

// export const currentEthValueAtom = atom(BIG_ZERO)
export const currentEthLoadingAtom = atom(true)
export const currentCrabPositionValueAtom = atom(BIG_ZERO)
export const currentCrabPositionValueInETHAtom = atom(BIG_ZERO)
export const profitableMovePercentAtom = atom(0)
export const crabStrategySlippageAtom = atom(DEFAULT_SLIPPAGE)
export const isTimeHedgeAvailableAtom = atom(false)
export const isPriceHedgeAvailableAtom = atom(false)
export const crabPositionValueLoadingAtom = atom(true)
export const userCrabShares = atom(BIG_ZERO)

export const currentEthLoadingAtomV2 = atom(true)
export const currentCrabPositionValueAtomV2 = atom(BIG_ZERO)
export const currentCrabPositionValueInETHAtomV2 = atom(BIG_ZERO)
export const currentCrabPositionETHActualAtomV2 = atom(BIG_ZERO)
export const profitableMovePercentAtomV2 = atom(0)
export const crabStrategySlippageAtomV2 = atom(DEFAULT_SLIPPAGE)
export const isTimeHedgeAvailableAtomV2 = atom(false)
export const isPriceHedgeAvailableAtomV2 = atom(false)
export const crabPositionValueLoadingAtomV2 = atom(true)
export const userCrabSharesV2 = atom(BIG_ZERO)
export const crabTotalSupplyV2Atom = atom(BIG_ZERO)

export const usdcQueuedAtom = atom(BIG_ZERO)
export const crabQueuedAtom = atom(BIG_ZERO)
export const crabQueuedInEthAtom = atom(BIG_ZERO)
export const crabQueuedInUsdAtom = atom(BIG_ZERO)
export const crabUSDValueAtom = atom(BIG_ZERO)

export const isNettingAuctionLiveAtom = atom(false)
export const minUSDCAmountAtom = atom(BIG_ZERO)
export const minCrabAmountAtom = atom(BIG_ZERO)

export const crabLoadingAtom = atom((get) => {
  const loading = get(loadingAtom)
  const ready = get(readyAtom)
  const currentEthLoading = get(currentEthLoadingAtom)
  return loading || !ready || currentEthLoading
})

export const crabLoadingAtomV2 = atom((get) => {
  const loading = get(loadingAtomV2)
  const ready = get(readyAtom)
  const currentEthLoading = get(currentEthLoadingAtomV2)
  return loading || !ready || currentEthLoading
})

export const crabv2StrategyFilterStartDateAtom = atom<Date>(new Date(CRABV2_START_DATE))
export const crabv2StrategyFilterEndDateAtom = atom<Date>(new Date())


export const useCrabPnLV2ChartData = () => {
  const startDate = useAtomValue(crabv2StrategyFilterStartDateAtom)
  const endDate = useAtomValue(crabv2StrategyFilterEndDateAtom)

  return useQuery(
    ['pnlChart', { startDate, endDate }],
    async () =>
      getCrabPnlV2ChartData(
        Number(startDate.valueOf().toString().slice(0, -3)),
        Number(endDate.valueOf().toString().slice(0, -3)),
      ),
    {
      staleTime: Infinity,
      refetchOnWindowFocus: true,
    },
  )
}



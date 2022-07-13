import { atom } from 'jotai'

import { BIG_ZERO } from '@constants/index'
import { Vault } from '../../types'
import { readyAtom } from '../squeethPool/atoms'

export const maxCapAtom = atom(BIG_ZERO)
export const crabStrategyVaultAtom = atom<Vault | null>(null)
export const crabStrategyCollatRatioAtom = atom(0)
export const crabStrategyLiquidationPriceAtom = atom(BIG_ZERO)
export const timeAtLastHedgeAtom = atom(0)
export const loadingAtom = atom(true)
// export const currentEthValueAtom = atom(BIG_ZERO)
export const currentEthLoadingAtom = atom(true)
export const currentCrabPositionValueAtom = atom(BIG_ZERO)
export const currentCrabPositionValueInETHAtom = atom(BIG_ZERO)
export const profitableMovePercentAtom = atom(0)
export const crabStrategySlippageAtom = atom(0.5)
export const isTimeHedgeAvailableAtom = atom(false)
export const isPriceHedgeAvailableAtom = atom(false)
export const crabPositionValueLoadingAtom = atom(true)
export const userCrabShares = atom(BIG_ZERO)

export const crabLoadingAtom = atom((get) => {
  const loading = get(loadingAtom)
  const ready = get(readyAtom)
  const currentEthLoading = get(currentEthLoadingAtom)
  return loading || !ready || currentEthLoading
})

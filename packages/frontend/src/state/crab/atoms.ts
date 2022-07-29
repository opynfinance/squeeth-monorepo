import { atom } from 'jotai'

import { BIG_ZERO, DEFAULT_SLIPPAGE } from '@constants/index'
import { Vault } from '../../types'
import { readyAtom } from '../squeethPool/atoms'

export const maxCapAtom = atom(BIG_ZERO)
export const crabStrategyVaultAtom = atom<Vault | null>(null)
export const crabStrategyCollatRatioAtom = atom(0)
export const crabStrategyLiquidationPriceAtom = atom(BIG_ZERO)
export const timeAtLastHedgeAtom = atom(0)
export const loadingAtom = atom(true)

export const maxCapAtomV2 = atom(BIG_ZERO)
export const crabStrategyVaultAtomV2 = atom<Vault | null>(null)
export const crabStrategyCollatRatioAtomV2 = atom(0)
export const crabStrategyLiquidationPriceAtomV2 = atom(BIG_ZERO)
export const timeAtLastHedgeAtomV2 = atom(0)
export const loadingAtomV2 = atom(true)

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

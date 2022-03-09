import { atom } from 'jotai'

import { BIG_ZERO } from '@constants/index'
import { Vault } from '../../types'

export const maxCapAtom = atom(BIG_ZERO)
export const crabStrategyVaultAtom = atom<Vault | null>(null)
export const crabStrategyCollatRatioAtom = atom(0)
export const crabStrategyLiquidationPriceAtom = atom(BIG_ZERO)
export const timeAtLastHedgeAtom = atom(0)
export const crabLoadingAtom = atom(true)
export const currentEthValueAtom = atom(BIG_ZERO)
export const profitableMovePercentAtom = atom(0)
export const crabStrategySlippageAtom = atom(0.5)
export const isTimeHedgeAvailableAtom = atom(false)
export const isPriceHedgeAvailableAtom = atom(false)

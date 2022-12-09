import BigNumber from 'bignumber.js'
import { atom } from 'jotai'

export const visibleStrategyRebalancesAtom = atom<number>(3)
export const bullCrabBalanceAtom = atom(new BigNumber(0))
export const bullSupplyAtom = atom(new BigNumber(0))

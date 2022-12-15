import BigNumber from 'bignumber.js'
import { atom } from 'jotai'

export const visibleStrategyRebalancesAtom = atom<number>(3)
export const bullCrabBalanceAtom = atom(new BigNumber(0))
export const bullSupplyAtom = atom(new BigNumber(0))
export const bullEulerWethCollatPerShareAtom = atom(new BigNumber(0))
export const bullEulerUsdcDebtPerShareAtom = atom(new BigNumber(0))
export const bullEthValuePerShareAtom = atom(new BigNumber(0))
export const bullCapAtom = atom(new BigNumber(0))
export const bullDepositedEthAtom = atom(new BigNumber(0))
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

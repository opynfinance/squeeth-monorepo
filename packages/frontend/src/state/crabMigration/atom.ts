import { BIG_ZERO } from '../../constants'
import { atom } from 'jotai'

export const totalMigratedSharesAtom = atom(BIG_ZERO)
export const userMigratedSharesAtom = atom(BIG_ZERO)
export const userMigratedSharesETHAtom = atom(BIG_ZERO)
export const isQueuedAtom = atom((get) => {
  const userQueuedShares = get(userMigratedSharesAtom)
  return userQueuedShares.gt(0)
})

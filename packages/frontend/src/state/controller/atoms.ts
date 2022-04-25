import { atom } from 'jotai'
import BigNumber from 'bignumber.js'

import { BIG_ZERO } from '@constants/index'

export const impliedVolAtom = atom((get) => {
  const mark = get(markAtom)
  const index = get(indexAtom)
  const currentImpliedFunding = get(currentImpliedFundingAtom)
  if (mark.isZero()) return 0
  if (mark.lt(index)) return 0
  if (currentImpliedFunding < 0) return 0

  return Math.sqrt(currentImpliedFunding * 365)
})

export const normFactorAtom = atom(new BigNumber(1))
export const dailyHistoricalFundingAtom = atom({ period: 0, funding: 0 })
export const currentImpliedFundingAtom = atom(0)
export const markAtom = atom(BIG_ZERO)
export const indexAtom = atom(BIG_ZERO)

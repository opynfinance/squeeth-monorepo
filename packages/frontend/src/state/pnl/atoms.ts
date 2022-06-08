import { atom } from 'jotai'
import { BIG_ZERO } from '@constants/index'

export const ethCollateralPnlAtom = atom(BIG_ZERO)
export const shortUnrealizedPNLAtom = atom({ usd: BIG_ZERO, eth: BIG_ZERO, loading: true })
export const longUnrealizedPNLAtom = atom({ usd: BIG_ZERO, eth: BIG_ZERO, loading: true })
export const buyQuoteAtom = atom(BIG_ZERO)
export const sellQuoteAtom = atom({
  amountOut: BIG_ZERO,
  minimumAmountOut: BIG_ZERO,
  priceImpact: '0',
  pools: Array<Array<any>>()
})

export const longGainAtom = atom(BIG_ZERO)
export const shortGainAtom = atom(BIG_ZERO)
export const loadingAtom = atom(true)

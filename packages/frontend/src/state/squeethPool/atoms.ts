import { Token } from '@uniswap/sdk-core'
import { Pool } from '@uniswap/v3-sdk'
import { atom } from 'jotai'
import BigNumber from 'bignumber.js'

import { isWethToken0Atom } from '../positions/atoms'
import { BIG_ZERO } from '@constants/index'
import { toTokenAmount } from '@utils/calculations'
export const poolAtom = atom<Pool | null>(null)
export const wethTokenAtom = atom<Token | null>(null)
export const squeethTokenAtom = atom<Token | null>(null)
export const wethPriceAtom = atom((get) => {
  const pool = get(poolAtom)
  const isWethToken0 = get(isWethToken0Atom)
  return toTokenAmount(
    new BigNumber(isWethToken0 ? pool?.token1Price.toSignificant(18) || 0 : pool?.token0Price.toSignificant(18) || 0),
    18,
  )
})
export const squeethInitialPriceAtom = atom(BIG_ZERO)
export const squeethPriceeAtom = atom(BIG_ZERO)
export const readyAtom = atom(false)

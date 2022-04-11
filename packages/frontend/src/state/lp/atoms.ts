import { SwapToRatioSuccess } from '@uniswap/smart-order-router'
import { TickMath } from '@uniswap/v3-sdk'
import { atom } from 'jotai'

export enum LP_TX_TYPE {
  NONE,
  ADD_LIQUIDITY,
  SWAP_AND_ADD_LIQUIDITY,
  MINT_AND_ADD_LIQUIDITY,
}

export enum BUY_AND_LP_STEPS {
  APPROVE_OSQTH = 'Approve oSQTH',
  SUBMIT_TX = 'Add Liquidity',
}

export const lpSqthAmountAtom = atom('')
export const lpEthAmountAtom = atom('')
export const lpIsSqthConstant = atom(true)
export const lpTickLower = atom(TickMath.MIN_TICK)
export const lpTickUpper = atom(TickMath.MIN_TICK)
export const lpTxTypeAtom = atom(LP_TX_TYPE.NONE)
export const lpBuyStepAtom = atom(BUY_AND_LP_STEPS.APPROVE_OSQTH)
export const lpSwapAndAddResultAtom = atom<SwapToRatioSuccess | null>(null)

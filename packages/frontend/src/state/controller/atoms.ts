import { atom } from 'jotai'
import BigNumber from 'bignumber.js'

import { BIG_ZERO } from '@constants/index'
import { networkIdAtom, web3Atom } from '../wallet/atoms'
import { getCurrentImpliedFunding, getDailyHistoricalFunding, getIndex, getMark } from './utils'
import { ETH_USDC_POOL, SQUEETH_UNI_POOL } from '@constants/address'
import { SWAP_EVENT_TOPIC } from '../../constants'
import { controllerContractAtom } from '../contracts/atoms'

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

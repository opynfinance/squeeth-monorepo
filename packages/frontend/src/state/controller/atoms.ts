import { atom } from 'jotai'
import { BIG_ZERO } from '@constants/index'
import BigNumber from 'bignumber.js'
import { toTokenAmount } from '@utils/calculations'
import { web3Atom } from '../wallet/atoms'
import { getContract } from '@utils/getContract'
import abi from '../../abis/controller.json'
import { addressesAtom } from '../positions/atoms'
import { getDailyHistoricalFunding } from './utils'

export const markAtom = atom(BIG_ZERO)
export const indexAtom = atom(BIG_ZERO)
export const currentImpliedFundingAtom = atom(0)

export const impliedVolAtom = atom((get) => {
  const mark = get(markAtom)
  const index = get(indexAtom)
  const currentImpliedFunding = get(currentImpliedFundingAtom)
  if (mark.isZero()) return 0
  if (mark.lt(index)) return 0
  if (currentImpliedFunding < 0) return 0

  return Math.sqrt(currentImpliedFunding * 365)
})

const normFactorResultAtom = atom(new BigNumber(1))
export const normFactorAtom = atom(
  (get) => get(normFactorResultAtom),
  (_get, set) => {
    const fetchData = async () => {
      const web3 = _get(web3Atom)
      const { controller } = _get(addressesAtom)
      const contract = getContract(web3, controller, abi)
      try {
        const response = await contract.methods.getExpectedNormalizationFactor().call()
        set(normFactorResultAtom, toTokenAmount(new BigNumber(response.toString()), 18))
      } catch (error) {
        try {
          const data = await contract.methods.normalizationFactor().call()
          set(normFactorResultAtom, toTokenAmount(new BigNumber(data.toString()), 18))
        } catch (error) {
          set(normFactorResultAtom, new BigNumber(1))
          console.log('normFactor error')
        }
      }
    }
    fetchData()
  },
)
normFactorAtom.onMount = (runFetch) => {
  runFetch()
}

const dailyHistoricalFundingResult = atom({ period: 0, funding: 0 })
export const dailyHistoricalFundingAtom = atom(
  (get) => get(dailyHistoricalFundingResult),
  (_get, set) => {
    const fetchData = async () => {
      const web3 = _get(web3Atom)
      const { controller } = _get(addressesAtom)
      const contract = getContract(web3, controller, abi)
      try {
        const response = await getDailyHistoricalFunding(contract)
        set(dailyHistoricalFundingResult, response)
      } catch (error) {
        set(dailyHistoricalFundingResult, { period: 0, funding: 0 })
      }
    }
    fetchData()
  },
)

dailyHistoricalFundingAtom.onMount = (fetchDailyHistoricalFunding) => {
  fetchDailyHistoricalFunding()
}

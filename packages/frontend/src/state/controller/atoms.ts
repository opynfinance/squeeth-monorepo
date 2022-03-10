import { atom } from 'jotai'
import { BIG_ZERO } from '@constants/index'
import BigNumber from 'bignumber.js'
import { toTokenAmount } from '@utils/calculations'
import { web3Atom } from '../wallet/atoms'
import { getContract } from '@utils/getContract'
import abi from '../../abis/controller.json'
import { addressesAtom } from '../positions/atoms'

export const markAtom = atom(BIG_ZERO)
export const indexAtom = atom(BIG_ZERO)
export const dailyHistoricalFundingAtom = atom({ period: 0, funding: 0 })
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

const normFactorAtom = atom(new BigNumber(1))
export const getNormFactorAtom = atom(
  (get) => get(normFactorAtom),
  (_get, set) => {
    const fetchData = async () => {
      const web3 = _get(web3Atom)
      const { controller } = _get(addressesAtom)
      const contract = getContract(web3, controller, abi)
      try {
        const response = await contract.methods.getExpectedNormalizationFactor().call()
        set(normFactorAtom, toTokenAmount(new BigNumber(response.toString()), 18))
      } catch (error) {
        try {
          const data = await contract.methods.normalizationFactor().call()
          set(normFactorAtom, toTokenAmount(new BigNumber(data.toString()), 18))
        } catch (error) {
          set(normFactorAtom, new BigNumber(1))
          console.log('normFactor error')
        }
      }
    }
    fetchData()
  },
)
getNormFactorAtom.onMount = (runFetch) => {
  runFetch()
}

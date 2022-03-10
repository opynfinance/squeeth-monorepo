import { atom } from 'jotai'
import { BIG_ZERO } from '@constants/index'
import BigNumber from 'bignumber.js'
import { toTokenAmount } from '@utils/calculations'
import { networkIdAtom, web3Atom } from '../wallet/atoms'
import { getContract } from '@utils/getContract'
import abi from '../../abis/controller.json'
import { addressesAtom } from '../positions/atoms'
import { getCurrentImpliedFunding, getDailyHistoricalFunding, getIndex, getMark } from './utils'
import { SWAP_EVENT_TOPIC } from '../../constants'

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

const currentImpliedFundingResult = atom(0)
export const currentImpliedFundingAtom = atom(
  (get) => get(currentImpliedFundingResult),
  (_get, set) => {
    const fetchData = async () => {
      const web3 = _get(web3Atom)
      const { controller } = _get(addressesAtom)
      const contract = getContract(web3, controller, abi)
      try {
        const response = await getCurrentImpliedFunding(contract)
        set(currentImpliedFundingResult, response)
      } catch (error) {
        set(currentImpliedFundingResult, 0)
      }
    }
    fetchData()
  },
)

currentImpliedFundingAtom.onMount = (fetchCurrentImpliedFunding) => {
  fetchCurrentImpliedFunding()
}
const markResultAtom = atom(BIG_ZERO)
export const markAtom = atom(
  (get) => get(markResultAtom),
  (_get, set) => {
    const fetchData = async () => {
      const contract = _get(controllerContractAtom)
      const web3 = _get(web3Atom)
      const networkId = _get(networkIdAtom)
      try {
        const response = await getMark(1, contract)
        set(markResultAtom, response)

        web3.eth.subscribe(
          'logs',
          {
            address: [SQUEETH_UNI_POOL[networkId]],
            topics: [SWAP_EVENT_TOPIC],
          },
          () => {
            getMark(3, contract).then((mark) => set(markResultAtom, mark))
          },
        )
      } catch (error) {
        set(markResultAtom, BIG_ZERO)
      }
    }
    fetchData()
  },
)

markAtom.onMount = (fetchMark) => {
  fetchMark()
}

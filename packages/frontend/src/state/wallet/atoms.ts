import { atom } from 'jotai'
import Web3 from 'web3'
import { API as NotifyAPI, TransactionData } from 'bnc-notify'
import { API } from 'bnc-onboard/dist/src/interfaces'

import { Networks } from '../../types'
import { atomWithReset } from 'jotai/utils'
import { BIG_ZERO } from '../../constants'

const useAlchemy = process.env.NEXT_PUBLIC_USE_ALCHEMY
const usePokt = process.env.NEXT_PUBLIC_USE_POKT

export const transactionDataAtom = atomWithReset<TransactionData | null>(null)
export const transactionLoadingAtom = atom((get) => {
  const transactionData = get(transactionDataAtom)

  if (
    transactionData?.status === 'sent' ||
    transactionData?.status === 'pending' ||
    transactionData?.status === 'speedup' ||
    transactionData?.status === 'cancel'
  ) {
    return true
  }

  if (transactionData?.status === 'confirmed' || transactionData?.status === 'failed') {
    return false
  }

  return false
})
export const cancelTransactionAtom = atomWithReset<boolean>(false)
export const addressAtom = atom<string | null>(null)
export const networkIdAtom = atom(Networks.MAINNET)

const defaultWeb3Atom = atom<any | null>(null)

export const web3Atom = atom(
  (get) => {
    const defaultProvider = get(defaultWeb3Atom)
    const networkId = get(networkIdAtom)
    const network = networkId === 1 ? 'mainnet' : 'ropsten'

    if (!defaultProvider) {
      const defaultWeb3 =
        useAlchemy === 'true'
          ? new Web3(`https://eth-${network}.alchemyapi.io/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`)
          : usePokt === 'true'
          ? new Web3(`https://eth-${network}.gateway.pokt.network/v1/lb/${process.env.NEXT_PUBLIC_POKT_ID}`)
          : new Web3(`https://${network}.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_API_KEY}`)
      return defaultWeb3
    }

    return defaultProvider
  },
  (get, set, provider) => {
    set(defaultWeb3Atom, provider)
  },
)
export const onboardAtom = atom<API | null>(null)
export const notifyAtom = atom<NotifyAPI | null>(null)
export const signerAtom = atom<any>(null)
export const supportedNetworkAtom = atom<boolean>(false)

export const connectedWalletAtom = atom((get) => {
  const address = get(addressAtom)
  const networkId = get(networkIdAtom)
  return Boolean(address && networkId)
})

export const walletBalanceAtom = atom(BIG_ZERO)

export const isTransactionFirstStepAtom = atom(false)

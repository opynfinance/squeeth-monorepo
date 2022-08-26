import { atom } from 'jotai'
import Web3 from 'web3'
import { API as NotifyAPI, TransactionData } from 'bnc-notify'
import { API } from 'bnc-onboard/dist/src/interfaces'

import { Networks } from '../../types'
import { atomWithReset } from 'jotai/utils'

const useAlchemy = process.env.NEXT_PUBLIC_USE_ALCHEMY
const usePokt = process.env.NEXT_PUBLIC_USE_POKT
const defaultWeb3 =
  useAlchemy === 'true'
    ? new Web3(`https://eth-mainnet.alchemyapi.io/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`)
    : usePokt === 'true'
    ? new Web3(`https://eth-mainnet.gateway.pokt.network/v1/lb/${process.env.NEXT_PUBLIC_POKT_ID}`)
    : new Web3(`https://mainnet.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_API_KEY}`)

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
export const web3Atom = atom(defaultWeb3)
export const onboardAtom = atom<API | null>(null)
export const notifyAtom = atom<NotifyAPI | null>(null)
export const signerAtom = atom<any>(null)
export const supportedNetworkAtom = atom<boolean>(false)

export const connectedWalletAtom = atom((get) => {
  const address = get(addressAtom)
  const networkId = get(networkIdAtom)
  return Boolean(address && networkId)
})

export const isTransactionFirstStepAtom = atom(false)
export const onboardAddressAtom = atom<string | null>(null)
export const walletFailVisibleAtom = atom(false)

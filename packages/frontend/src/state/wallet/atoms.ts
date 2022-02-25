import { atom } from 'jotai'
import Web3 from 'web3'
import { API as NotifyAPI } from 'bnc-notify'
import { API } from 'bnc-onboard/dist/src/interfaces'

import { Networks } from '../../types'

const useAlchemy = process.env.NEXT_PUBLIC_USE_ALCHEMY
const defaultWeb3 = useAlchemy
  ? new Web3(`https://eth-mainnet.alchemyapi.io/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`)
  : new Web3(`https://mainnet.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_API_KEY}`)

export const addressAtom = atom<string | null>(null)
export const networkIdAtom = atom(Networks.MAINNET)
export const web3Atom = atom(defaultWeb3)
export const onboardAtom = atom<API | null>(null)
export const notifyAtom = atom<NotifyAPI | null>(null)
export const signerAtom = atom<any>(null)

export const connectedWalletAtom = atom((get) => {
  const address = get(addressAtom)
  const networkId = get(networkIdAtom)
  return Boolean(address && networkId)
})

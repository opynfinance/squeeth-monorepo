import { createReducer } from '@reduxjs/toolkit'
import BigNumber from 'bignumber.js'
import Web3 from 'web3'
import { API as NotifyAPI } from 'bnc-notify'
import { API as OnboardAPI } from 'bnc-onboard/dist/src/interfaces'
import { Networks } from '../../types'
import { setWeb3Settings, setAddress } from './actions'

const useAlchemy = process.env.NEXT_PUBLIC_USE_ALCHEMY
const defaultWeb3 = useAlchemy
  ? new Web3(`https://eth-mainnet.alchemyapi.io/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`)
  : new Web3(`https://mainnet.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_API_KEY}`)

export interface WalletState {
  onboard?: OnboardAPI
  notify?: NotifyAPI
  web3: Web3
  address: string | null
  networkId: Networks
  signer: any
  balance: BigNumber
}

export const initialState: WalletState = {
  web3: defaultWeb3,
  onboard: undefined,
  notify: undefined,
  address: null,
  networkId: Networks.MAINNET,
  signer: null,
  balance: new BigNumber(0),
}

export default createReducer(initialState, (builder) =>
  builder
    .addCase(setWeb3Settings, (state, { payload }) => {
      const { signer, web3, balance, onboard, networkId, notify } = payload

      state.onboard = onboard || state.onboard
      state.signer = signer || state.signer
      state.web3 = web3 !== undefined ? web3 : state.web3
      state.networkId = networkId || state.networkId
      state.balance = balance || state.balance
      state.notify = notify || state.notify
    })
    .addCase(setAddress, (state, { payload }) => {
      state.address = payload
    }),
)

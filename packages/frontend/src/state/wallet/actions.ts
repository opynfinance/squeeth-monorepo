import { createAction } from '@reduxjs/toolkit'
import Web3 from 'web3'
import BigNumber from 'bignumber.js'
import { API as OnboardAPI } from 'bnc-onboard/dist/src/interfaces'
import { API as NotifyAPI } from 'bnc-notify'
import { Networks } from '../../types'

export interface SetWeb3Settings {
  web3?: Web3
  signer?: any
  balance?: BigNumber
  onboard?: OnboardAPI
  notify?: NotifyAPI
  networkId?: Networks
}

export const setWeb3Settings = createAction<SetWeb3Settings>('wallet/setWeb3Settings')
export const setAddress = createAction<string | null>('wallet/setAddress')
export const setConnected = createAction<boolean>('wallet/setConnected')

import axios from 'axios'
import React, { createContext, ReactNode, useContext, useEffect, useReducer, useState } from 'react'
import { useQuery } from 'react-query'

import { csvJSON } from '../utils/csvToJson'
import { useWallet } from './wallet'

export enum LoginState {
  GUEST = 'GUEST',
  WHITELISTED = 'WHITELISTED',
  NOT_WHITELISTED = 'NOT_WHITELISTED',
}

type State = {
  me?: { address: string; loginState: LoginState }
  loading: boolean
  error?: Error
}

type Action =
  | { type: 'REQUEST' }
  | { type: 'SUCCESS'; data: string }
  | { type: 'FAILURE'; error: Error }
  | { type: 'NOT_VERIFIED'; error: Error }
  | { type: 'LOGOUT' }

const actions = {
  request: (): Action => ({ type: 'REQUEST' }),
  success: (data: string): Action => ({ type: 'SUCCESS', data }),
  failure: (error: Error): Action => ({ type: 'FAILURE', error }),
  notVerified: (error: Error): Action => ({ type: 'NOT_VERIFIED', error }),
  logout: (): Action => ({ type: 'LOGOUT' }),
}

const reducer = (state: State, action: Action) => {
  switch (action.type) {
    case 'REQUEST':
      return { ...state, loading: true, error: undefined }
    case 'SUCCESS':
      return {
        ...state,
        loading: false,
        me: { address: action.data, loginState: LoginState.WHITELISTED },
      }
    case 'FAILURE':
      return {
        ...state,
        me: { address: '', loginState: LoginState.GUEST },
        loading: false,
        error: action.error,
      }
    case 'NOT_VERIFIED':
      return {
        ...state,
        me: { address: '', loginState: LoginState.NOT_WHITELISTED },
        loading: false,
        error: action.error,
      }
    case 'LOGOUT':
      return { ...state, me: { address: '', loginState: LoginState.GUEST }, login: false }
    default:
      return state
  }
}

interface WhitelistProviderProps {
  children: ReactNode
}

interface WhitelistData {
  whitelistAddrs: string[]
  me?: { address: string; loginState: LoginState }
  loading: boolean
  error?: Error
  setMe: Function
  logout: Function
  setNotVerified: Function
}

const WhitelistContext = createContext<WhitelistData>({
  whitelistAddrs: [],
  loading: true,
  setMe: () => {},
  logout: () => {},
  setNotVerified: () => {},
})

export const WhitelistProvider = ({ children }: WhitelistProviderProps): JSX.Element => {
  const [whitelistAddrs, setwhitelistAddrs] = useState<string[]>([])
  const [state, dispatch] = useReducer(reducer, {
    loading: true,
  })

  const { disconnectWallet, connected, address } = useWallet()

  useEffect(() => {
    axios
      .get(
        `https://docs.google.com/spreadsheets/d/1XEYJrg8zEt55MWRwAu752sUXG0UNHROyNduewn94Yxs/export?gid=0&format=csv`,
      )
      .then((res) => {
        const address = res.data
        const totalData = JSON.parse(csvJSON(address))
        setwhitelistAddrs(totalData)
      })
  }, [])

  useEffect(() => {
    if (!connected || !address || whitelistAddrs.length === 0) {
      logout()
    } else if (connected && address && !whitelistAddrs.includes(address)) {
      setNotVerified()
    }
  }, [connected, address, whitelistAddrs])

  const { isLoading } = useQuery('auth', async () => {
    dispatch(actions.request())

    if (!address || !connected || whitelistAddrs.length === 0) {
      dispatch(actions.failure(new Error('Wallet Not Connected or Wrong connected network')))
      return
    }

    if (whitelistAddrs.includes(address)) {
      dispatch(actions.success(address))
    } else {
      dispatch(actions.notVerified(new Error('Not whitelisted User')))
    }
  })

  const setNotVerified = async () => {
    try {
      dispatch(actions.notVerified(new Error('Not whitelisted User')))
    } catch (err) {
      console.log(err)
    }
  }

  const logout = async () => {
    try {
      // disconnectWallet()
      dispatch(actions.logout())
    } catch (err) {
      console.log(err)
    }
  }

  const setMe = (data: string) => dispatch(actions.success(data))

  const authData = {
    whitelistAddrs: whitelistAddrs,
    me: state.me,
    loading: isLoading,
    setMe,
    logout,
    setNotVerified,
  }

  return <WhitelistContext.Provider value={authData}>{children}</WhitelistContext.Provider>
}

export const useWhitelist = (): WhitelistData => {
  return useContext(WhitelistContext)
}

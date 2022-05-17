import React, { useContext, useState, useCallback } from 'react'
import { useCookies } from 'react-cookie'
import { useAtomValue } from 'jotai'
import { useRouter } from 'next/router'

import { Networks } from '../types'
import { networkIdAtom } from 'src/state/wallet/atoms'
import useAppEffect from '@hooks/useAppEffect'

type restrictUserContextType = {
  isRestricted: boolean
  handleRestrictUser: (isRestricted: boolean) => void
}

const initialState: restrictUserContextType = {
  isRestricted: false,
  handleRestrictUser: () => null,
}

const restrictUserContext = React.createContext<restrictUserContextType>(initialState)
const useRestrictUser = () => useContext(restrictUserContext)

const RestrictUserProvider: React.FC = ({ children }) => {
  const networkId = useAtomValue(networkIdAtom)
  const [cookies] = useCookies(['restricted'])
  const [state, setState] = useState({
    isRestricted: false,
  })
  const router = useRouter()

  const handleRestrictUser = useCallback((isRestricted: boolean) => {
    setState((prevState) => ({
      ...prevState,
      isRestricted: isRestricted,
    }))
  }, [])

  useAppEffect(() => {
    if (
      router.query?.restricted?.includes('true') ||
      (cookies?.restricted?.split(',')[0] === 'true' && networkId !== Networks.ROPSTEN)
    ) {
      handleRestrictUser(true)
    } else {
      handleRestrictUser(false)
    }
  }, [cookies?.restricted, handleRestrictUser, networkId, router.query?.restricted])

  return (
    <restrictUserContext.Provider value={{ handleRestrictUser, isRestricted: state.isRestricted }}>
      {children}
    </restrictUserContext.Provider>
  )
}

export { RestrictUserProvider, useRestrictUser }

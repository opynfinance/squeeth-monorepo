import React, { useContext, useState, useCallback, useEffect } from 'react'
import { useCookies } from 'react-cookie'

import { Networks } from '../types'
import { useNetworkId } from 'src/state/wallet/hooks'

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
  const { networkId } = useNetworkId()
  const [cookies] = useCookies(['restricted'])
  const [state, setState] = useState({
    isRestricted: false,
  })

  const handleRestrictUser = useCallback((isRestricted: boolean) => {
    setState((prevState) => ({
      ...prevState,
      isRestricted: isRestricted,
    }))
  }, [])

  useEffect(() => {
    if (cookies?.restricted?.split(',')[0] === 'true' && networkId !== Networks.ROPSTEN) {
      handleRestrictUser(true)
    } else {
      handleRestrictUser(false)
    }
  }, [handleRestrictUser, cookies?.restricted, networkId])

  return (
    <restrictUserContext.Provider value={{ handleRestrictUser, isRestricted: state.isRestricted }}>
      {children}
    </restrictUserContext.Provider>
  )
}

export { RestrictUserProvider, useRestrictUser }

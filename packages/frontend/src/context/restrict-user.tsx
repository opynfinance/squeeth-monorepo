import React, { useContext, useState, useCallback, useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { useRouter } from 'next/router'

import { Networks } from '../types'
import { networkIdAtom } from 'src/state/wallet/atoms'
import { BLOCKED_COUNTRIES } from '../constants/index'

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
  const router = useRouter()
  const networkId = useAtomValue(networkIdAtom)
  const userLocation = router.query?.ct
  const isRestricted = BLOCKED_COUNTRIES.includes(String(userLocation))
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
    if (isRestricted && networkId === Networks.MAINNET) {
      handleRestrictUser(true)
    } else {
      handleRestrictUser(false)
    }
  }, [handleRestrictUser, networkId, isRestricted])

  return (
    <restrictUserContext.Provider value={{ handleRestrictUser, isRestricted: state.isRestricted }}>
      {children}
    </restrictUserContext.Provider>
  )
}

export { RestrictUserProvider, useRestrictUser }

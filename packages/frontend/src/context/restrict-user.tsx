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
  const [cookies] = useCookies(['opyn_geo'])
  const [state, setState] = useState({
    isRestricted: false,
  })

  const handleRestrictUser = useCallback((isRestricted: boolean) => {
    setState((prevState) => ({
      ...prevState,
      isRestricted: isRestricted,
    }))
  }, [])

  useAppEffect(() => {
    if (!cookies?.opyn_geo && networkId !== Networks.ROPSTEN) {
      handleRestrictUser(true)
    } else if (cookies?.opyn_geo?.split(',')[0] === 'true' && networkId !== Networks.ROPSTEN) {
      handleRestrictUser(true)
    } else {
      handleRestrictUser(false)
    }
  }, [cookies?.opyn_geo, handleRestrictUser, networkId])

  return (
    <restrictUserContext.Provider value={{ handleRestrictUser, isRestricted: state.isRestricted }}>
      {children}
    </restrictUserContext.Provider>
  )
}

export { RestrictUserProvider, useRestrictUser }

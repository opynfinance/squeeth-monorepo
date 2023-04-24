import React, { useContext, useState, useCallback, useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { useRouter } from 'next/router'

import { Networks } from '../types'
import { networkIdAtom } from 'src/state/wallet/atoms'
import { ALLOW_WITHDRAWALS, BLOCKED_COUNTRIES } from '../constants/index'

type restrictUserContextType = {
  isRestricted: boolean
  isWithdrawAllowed: boolean
  handleRestrictUser: (isRestricted: boolean, isWithdrawAllowed: boolean) => void
}

const initialState: restrictUserContextType = {
  isRestricted: false,
  isWithdrawAllowed: true,
  handleRestrictUser: () => null,
}

const restrictUserContext = React.createContext<restrictUserContextType>(initialState)
const useRestrictUser = () => useContext(restrictUserContext)

const RestrictUserProvider: React.FC = ({ children }) => {
  const router = useRouter()
  const networkId = useAtomValue(networkIdAtom)
  const userLocation = router.query?.ct
  const isRestricted = BLOCKED_COUNTRIES.includes(String(userLocation))
  const isWithdrawAllowed = ALLOW_WITHDRAWALS.includes(String(userLocation))

  const [state, setState] = useState({
    isRestricted: false,
    isWithdrawAllowed: false,
  })

  const handleRestrictUser = useCallback((isRestricted: boolean, isWithdrawAllowed: boolean) => {
    setState((prevState) => ({
      ...prevState,
      isRestricted: isRestricted,
      isWithdrawAllowed,
    }))
  }, [])

  useEffect(() => {
    if (isRestricted && networkId === Networks.MAINNET) {
      handleRestrictUser(true, isWithdrawAllowed)
    } else {
      handleRestrictUser(false, true)
    }
  }, [handleRestrictUser, networkId, isRestricted, isWithdrawAllowed])

  return (
    <restrictUserContext.Provider
      value={{ handleRestrictUser, isRestricted: state.isRestricted, isWithdrawAllowed: state.isWithdrawAllowed }}
    >
      {children}
    </restrictUserContext.Provider>
  )
}

export { RestrictUserProvider, useRestrictUser }

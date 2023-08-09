import React, { useContext, useState, useCallback, useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { useRouter } from 'next/router'

import { Networks } from '../types'
import { networkIdAtom } from 'src/state/wallet/atoms'
import { ALLOW_WITHDRAWALS, BLOCKED_COUNTRIES } from '../constants/index'

type restrictUserContextType = {
  isRestricted: boolean
  isWithdrawAllowed: boolean
  isBlockedUser: boolean
  handleRestrictUser: (isRestricted: boolean, isWithdrawAllowed: boolean) => void
  blockUser: () => void
}

const initialState: restrictUserContextType = {
  isRestricted: false,
  isWithdrawAllowed: true,
  isBlockedUser: false,
  handleRestrictUser: () => null,
  blockUser: () => null,
}

const restrictUserContext = React.createContext<restrictUserContextType>(initialState)
const useRestrictUser = () => useContext(restrictUserContext)

const RestrictUserProvider: React.FC = ({ children }) => {
  const router = useRouter()
  const networkId = useAtomValue(networkIdAtom)
  const userLocation = router.query?.ct
  const [isBlockedUser, setIsBlockedUser] = useState(false)
  const isRestricted = BLOCKED_COUNTRIES.includes(String(userLocation)) || isBlockedUser
  const isWithdrawAllowed = ALLOW_WITHDRAWALS.includes(String(userLocation)) || isBlockedUser

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

  const blockUser = useCallback(() => {
    setIsBlockedUser(true)
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
      value={{
        handleRestrictUser,
        isRestricted: state.isRestricted,
        isWithdrawAllowed: state.isWithdrawAllowed,
        blockUser,
        isBlockedUser,
      }}
    >
      {children}
    </restrictUserContext.Provider>
  )
}

export { RestrictUserProvider, useRestrictUser }

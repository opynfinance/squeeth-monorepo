import React, { useContext, useState, useCallback, useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { useRouter } from 'next/router'

import { Networks } from '../types'
import { networkIdAtom } from 'src/state/wallet/atoms'
import { BLOCKED_COUNTRIES } from '../constants/index'

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
  const [isRestricted, setIsRestricted] = useState(false)

  const handleRestrictUser = useCallback((isRestrictedFlag: boolean) => {
    setIsRestricted(isRestrictedFlag)
  }, [])

  const blockUser = useCallback(() => {
    setIsBlockedUser(true)
  }, [])

  const isUserRestricted = BLOCKED_COUNTRIES.includes(String(userLocation)) || isBlockedUser
  useEffect(() => {
    if (isUserRestricted && networkId === Networks.MAINNET) {
      handleRestrictUser(true)
    } else {
      handleRestrictUser(false)
    }
  }, [handleRestrictUser, networkId, isUserRestricted])

  return (
    <restrictUserContext.Provider
      value={{
        handleRestrictUser,
        isRestricted,
        isWithdrawAllowed: true,
        blockUser,
        isBlockedUser,
      }}
    >
      {children}
    </restrictUserContext.Provider>
  )
}

export { RestrictUserProvider, useRestrictUser }

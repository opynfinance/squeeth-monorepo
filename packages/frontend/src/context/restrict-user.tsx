import React, { useContext, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/router'

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
    if (router?.query?.restricted === 'true') {
      handleRestrictUser(true)
    }
  }, [handleRestrictUser, router.query.restricted])

  return (
    <restrictUserContext.Provider value={{ handleRestrictUser, isRestricted: state.isRestricted }}>
      {children}
    </restrictUserContext.Provider>
  )
}

export { RestrictUserProvider, useRestrictUser }

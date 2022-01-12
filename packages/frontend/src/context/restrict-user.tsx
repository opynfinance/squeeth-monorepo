import React, { useContext, useState } from 'react'

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
  const [state, setState] = useState({
    isRestricted: false,
  })

  const handleRestrictUser = (isRestricted: boolean) => {
    setState((prevState) => ({
      ...prevState,
      isRestricted: isRestricted,
    }))
  }

  return (
    <restrictUserContext.Provider value={{ handleRestrictUser, isRestricted: state.isRestricted }}>
      {children}
    </restrictUserContext.Provider>
  )
}

export { RestrictUserProvider, useRestrictUser }

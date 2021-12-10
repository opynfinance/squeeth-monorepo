import Router from 'next/router'
import React, { useEffect } from 'react'

import { LoginState, useWhitelist } from '../context/whitelist'

export const withRequiredAddr = <P extends {}>(Component: React.ComponentType<P>): React.FC<P> => {
  const WithRequiredAddr: React.FC<P> = (props) => {
    const { me, loading } = useWhitelist()

    useEffect(() => {
      if (!loading && me?.loginState !== LoginState.WHITELISTED) Router.push('/signin')
    }, [loading, me])

    if (!me?.address) return null

    return <Component {...props} />
  }

  return WithRequiredAddr
}

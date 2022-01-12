import { useRouter } from 'next/router'
import { useEffect } from 'react'

import { useRestrictUser } from '@context/restrict-user'

const App = () => {
  const router = useRouter()
  const { handleRestrictUser, isRestricted } = useRestrictUser()

  useEffect(() => {
    handleRestrictUser(true)
  }, [handleRestrictUser])

  useEffect(() => {
    if (isRestricted) {
      router.replace('/')
    }
  }, [isRestricted, router])

  return null
}

export default App

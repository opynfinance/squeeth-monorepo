import React, { useEffect } from 'react'
import { useRouter } from 'next/router'

const Redirection = () => {
  const router = useRouter()

  useEffect(() => {
    router.push('/strategies/crab', undefined, { shallow: true })
  }, [router])

  return <></>
}

const Page: React.FC = () => <Redirection />

export default Page

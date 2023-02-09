import React, { useEffect } from 'react'
import { useRouter } from 'next/router'

import { ROUTES } from '@constants/routes'

const Redirection = () => {
  const router = useRouter()

  useEffect(() => {
    router.push(ROUTES.STRATEGY.CRAB, undefined, { shallow: true })
  }, [router])

  return <></>
}

const Page: React.FC = () => <Redirection />

export default Page

export async function getServerSideProps() {
  return {
    redirect: {
      destination: ROUTES.STRATEGY.CRAB,
      permanent: true,
    },
  }
}

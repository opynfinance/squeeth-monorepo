import React, { useEffect } from 'react'
import { useRouter } from 'next/router'
import { GetServerSideProps } from 'next'

const Redirection = () => {
  const router = useRouter()

  useEffect(() => {
    router.push('/strategies/crab', undefined, { shallow: true })
  }, [router])

  return <></>
}

const Page: React.FC = () => <Redirection />

export default Page

export const getServerSideProps: GetServerSideProps = async ({ query }) => {
  const queryParams = new URLSearchParams(query as Record<string, string>)

  return {
    redirect: {
      destination: `/strategies/crab?${queryParams.toString()}`,
      permanent: true,
    },
  }
}

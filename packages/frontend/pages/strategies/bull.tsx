import React from 'react'

import BullStrategy from '@components/Strategies/Bull'
import { SQUEETH_BASE_URL } from '@constants/index'
import SiteSeo from '@components/SiteSeo'

const Page: React.FC = () => {
  return (
    <>
      <SiteSeo
        title="Zen Bull Strategy - Stack ETH"
        description="Stack ETH when ETH increases slow and steady"
        ogImage={SQUEETH_BASE_URL + '/images/previews/bull.png'}
        ogImageAlt="Opyn Zen Bull Strategy"
      />

      <BullStrategy />
    </>
  )
}

export default Page

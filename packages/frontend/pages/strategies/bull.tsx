import React from 'react'
import { NextSeo } from 'next-seo'

import BullStrategy from '@components/Strategies/Bull'
import { SQUEETH_BASE_URL } from '@constants/index'

const Page: React.FC = () => {
  return (
    <>
      <NextSeo
        title="Opyn Zen Bull Strategy - Stack ETH"
        description="Stack ETH when ETH increases slow and steady"
        canonical={SQUEETH_BASE_URL}
        openGraph={{
          images: [
            {
              url: SQUEETH_BASE_URL + '/images/previews/bull.png',
              width: 1200,
              height: 630,
              alt: 'Zen Bull Strategy',
            },
          ],
        }}
        twitter={{
          handle: '@opyn_',
          site: '@opyn_',
          cardType: 'summary_large_image',
        }}
      />

      <BullStrategy />
    </>
  )
}

export default Page

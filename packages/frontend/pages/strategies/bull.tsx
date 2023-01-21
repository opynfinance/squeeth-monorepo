import React from 'react'
import { NextSeo } from 'next-seo'

import BullStrategy from '@components/Strategies/Bull'
import { SQUEETH_BASE_URL } from '@constants/index'

const Page: React.FC = () => {
  return (
    <>
      <NextSeo
        title="Opyn"
        description="Opyn builds DeFi strategies and derivatives like squeeth, a new financial primitive providing perpetual leverage without liquidations"
        canonical={SQUEETH_BASE_URL}
        openGraph={{
          images: [
            {
              url: SQUEETH_BASE_URL + '/images/squeeth-og-image.png',
              width: 1200,
              height: 630,
              alt: 'Squeeth',
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

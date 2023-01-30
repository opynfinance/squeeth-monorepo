import React from 'react'
import { NextSeo } from 'next-seo'
import { SiteMetaDescription, SiteMetaImage, SiteMetaTitle, SQUEETH_BASE_URL } from '@constants/index'

const DefaultSiteSeo: React.FC = () => {
  return (
    <NextSeo
      title={SiteMetaTitle}
      description={SiteMetaDescription}
      canonical={SQUEETH_BASE_URL}
      openGraph={{
        images: [
          {
            url: SiteMetaImage,
            width: 1200,
            height: 630,
            alt: 'Opyn',
          },
        ],
      }}
      twitter={{
        handle: '@opyn_',
        site: '@opyn_',
        cardType: 'summary_large_image',
      }}
    />
  )
}

export default DefaultSiteSeo

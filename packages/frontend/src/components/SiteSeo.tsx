import React from 'react'
import { NextSeo } from 'next-seo'

import { SEO_DEFAULTS, SQUEETH_BASE_URL } from '@constants/index'

interface SiteSeoProps {
  title?: string
  description?: string
  ogImage?: string
}

const SiteSeo: React.FC<SiteSeoProps> = ({
  title = SEO_DEFAULTS.TITLE,
  description = SEO_DEFAULTS.DESCRIPTION,
  ogImage = SEO_DEFAULTS.OG_IMAGE,
}) => {
  return (
    <NextSeo
      title={title}
      description={description}
      canonical={SQUEETH_BASE_URL}
      openGraph={{
        images: [
          {
            url: ogImage,
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

export default SiteSeo

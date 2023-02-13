import React from 'react'

import BullStrategy from '@components/Strategies/Bull'
import SiteSeo from '@components/SiteSeo'
import { BULL_SEO_DEFAULTS } from '@constants/seo'

const Page: React.FC = () => {
  return (
    <>
      <SiteSeo
        title={BULL_SEO_DEFAULTS.TITLE}
        description={BULL_SEO_DEFAULTS.DESCRIPTION}
        ogImage={BULL_SEO_DEFAULTS.OG_IMAGE}
        ogImageAlt={BULL_SEO_DEFAULTS.OG_IMAGE_ALT}
      />

      <BullStrategy />
    </>
  )
}

export default Page

import { NextSeo } from 'next-seo'

import { getMarkdown } from '@utils/markdown'
import MarkdownPage from '@components/MarkdownPage'
import { SQUEETH_BASE_URL } from '@constants/index'

const TermsOfServiceFAQ = (props: any) => {
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

      <MarkdownPage markdown={props.file} />
    </>
  )
}

export async function getStaticProps() {
  const file = getMarkdown('terms-of-service-faq')

  return { props: { file } }
}

export default TermsOfServiceFAQ

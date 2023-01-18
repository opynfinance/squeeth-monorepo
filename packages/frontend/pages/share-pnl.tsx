import { Box, Typography } from '@material-ui/core'
import { GetServerSideProps } from 'next'
import { NextSeo } from 'next-seo'

import { SQUEETH_BASE_URL } from '@constants/index'

type StrategyType = 'crab' | 'zenbull'

interface SharePnlProps {
  strategy: StrategyType
  depositedAt: string
  pnl: string
}

const SharePnl = ({ strategy, depositedAt, pnl }: SharePnlProps) => {
  const title = strategy === 'crab' ? 'Opyn Crab Strategy - Stack USDC' : 'Opyn Zen Bull Strategy - Stack ETH'
  const description =
    strategy === 'crab' ? 'Stack USDC when ETH is flat' : 'Stack ETH when ETH increases slow and steady'
  const ogImageUrl = SQUEETH_BASE_URL + '/api/pnl?strategy=' + strategy + '&depositedAt=' + depositedAt + '&pnl=' + pnl

  return (
    <>
      <NextSeo
        title={title}
        description={description}
        canonical={SQUEETH_BASE_URL}
        openGraph={{
          type: 'website',
          images: [
            {
              url: ogImageUrl,
              width: 1200,
              height: 630,
              alt: title,
            },
          ],
        }}
        twitter={{
          handle: '@opyn_',
          site: '@opyn_',
          cardType: 'summary_large_image',
        }}
      />

      <Box marginTop="20px" marginLeft="20px">
        <Typography variant="h3">/share-pnl page</Typography>
      </Box>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { strategy, depositedAt, pnl } = context.query
  return { props: { strategy, depositedAt, pnl } }
}

export default SharePnl

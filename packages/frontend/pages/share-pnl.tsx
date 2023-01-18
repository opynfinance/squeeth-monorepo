import Head from 'next/head'
import { Box, Typography } from '@material-ui/core'
import { GetServerSideProps } from 'next'

import { SQUEETH_BASE_URL } from '@constants/index'

type StrategyType = 'crab' | 'zenbull'

interface SharePnlProps {
  strategy: StrategyType
  depositedAt: string
  pnl: string
}

const SharePnl = ({ strategy, depositedAt, pnl }: SharePnlProps) => {
  const url = strategy === 'crab' ? 'https://squeeth.opyn.co/strategies' : 'https://squeeth.opyn.co/strategies/zenbull'
  const title = strategy === 'crab' ? 'Opyn Crab Strategy - Stack USDC' : 'Opyn Zen Bull Strategy - Stack ETH'
  const description =
    strategy === 'crab' ? 'Stack USDC when ETH is flat' : 'Stack ETH when ETH increases slow and steady'
  const ogImageUrl = SQUEETH_BASE_URL + '/api/pnl?strategy=' + strategy + '&depositedAt=' + depositedAt + '&pnl=' + pnl

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="title" content={title} />
        <meta name="description" content={description} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={ogImageUrl} />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content={url} />
        <meta property="twitter:title" content={title} />
        <meta property="twitter:description" content={description} />
        <meta property="twitter:image" content={ogImageUrl} />
      </Head>

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

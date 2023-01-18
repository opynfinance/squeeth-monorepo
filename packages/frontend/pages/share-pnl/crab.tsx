import Head from 'next/head'
import { Box, Typography } from '@material-ui/core'
import { useRouter } from 'next/router'

import { SQUEETH_BASE_URL } from '@constants/index'

const SharePnl = () => {
  const router = useRouter()
  const depositedAt = router.query.depositedAt
  const pnl = router.query.pnl
  const strategy = 'crab'

  const url = 'https://squeeth.opyn.co'
  const title = `Opyn Crab Strategy - Stack USDC`
  const description = `Stack USDC when ETH is flat`
  const ogImageUrl = SQUEETH_BASE_URL + '/api/pnl?strategy=' + strategy + '&depositedAt=' + depositedAt + '&pnl=' + pnl

  return (
    <>
      <Head>
        {/* Primary Meta Tags */}
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

export default SharePnl

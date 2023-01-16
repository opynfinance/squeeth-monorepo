import Head from 'next/head'
import { Box, Typography } from '@material-ui/core'
import { useRouter } from 'next/router'

import { squeethBaseUrl } from '@constants/index'

const SharePnl = () => {
  const router = useRouter()
  const depositedAt = router.query.depositedAt
  const pnl = router.query.pnl

  return (
    <>
      <Head>
        <title>The post title</title>
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Squeeth" />
        <meta
          name="twitter:description"
          content="Squeeth is a new financial primitive in DeFi that gives traders exposure to ETH²"
        />
        <meta name="twitter:image" content={`${squeethBaseUrl}/api/pnl?depositedAt=${depositedAt}&pnl=${pnl}`} />
        <meta property="og:image" content={`${squeethBaseUrl}/api/pnl?depositedAt=${depositedAt}&pnl=${pnl}`} />
      </Head>

      <Box marginTop="20px" marginLeft="20px">
        <Typography variant="h3">/share-pnl page</Typography>
      </Box>
    </>
  )
}

export default SharePnl

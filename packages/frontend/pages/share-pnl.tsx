import Head from 'next/head'
import { Box, Typography } from '@material-ui/core'
import { useRouter } from 'next/router'

const BASE_URL = 'https://continuouscall-git-share-pnl-with-og-opynfinance.vercel.app'

const SharePnl = () => {
  const router = useRouter()
  const depositedAt = router.query.depositedAt

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
        <meta name="twitter:image" content={`${BASE_URL}/api/pnl?depositedAt=${depositedAt}`} />
        <meta property="og:image" content={`${BASE_URL}/api/pnl?depositedAt=${depositedAt}`} />
      </Head>

      <Box marginTop="20px" marginLeft="20px">
        <Typography variant="h3">/share-pnl page</Typography>
      </Box>
    </>
  )
}

export default SharePnl

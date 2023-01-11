import Head from 'next/head'
import { Box, Typography } from '@material-ui/core'

const SharePnl = () => {
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
        <meta name="twitter:image" content="https://squeeth.opyn.co/api/pnl?title=my-post-title" />
        <meta property="og:image" content="https://squeeth.opyn.co/api/pnl?title=my-post-title" />
      </Head>

      <Box marginTop="20px" marginLeft="20px">
        <Typography variant="h3">/share-pnl page</Typography>
      </Box>
    </>
  )
}

export default SharePnl

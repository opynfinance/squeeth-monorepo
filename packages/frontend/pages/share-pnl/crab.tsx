import Head from 'next/head'
import { Box, Typography } from '@material-ui/core'
import { useRouter } from 'next/router'

import { SQUEETH_BASE_URL } from '@constants/index'

const SharePnl = () => {
  const router = useRouter()
  const depositedAt = router.query.depositedAt
  const pnl = router.query.pnl
  const strategy = 'crab'

  const ogImageUrl = `${SQUEETH_BASE_URL}/api/pnl?strategy=${strategy}&depositedAt=${depositedAt}&pnl=${pnl}`

  return (
    <>
      <Head>
        <title>Opyn Crab Strategy - Stack USDC</title>
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Opyn Crab Strategy - Stack USDC" />
        <meta name="twitter:description" content="Stack USDC when ETH is flat" />
        <meta name="twitter:image" content={ogImageUrl} />
        <meta property="og:image" content={ogImageUrl} />
      </Head>

      <Box marginTop="20px" marginLeft="20px">
        <Typography variant="h3">/share-pnl page</Typography>
      </Box>
    </>
  )
}

export default SharePnl

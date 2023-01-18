import Head from 'next/head'
import { Box, Typography } from '@material-ui/core'
import { useRouter } from 'next/router'

import { SQUEETH_BASE_URL } from '@constants/index'

const SharePnl = () => {
  const router = useRouter()
  const depositedAt = router.query.depositedAt
  const pnl = router.query.pnl
  const strategy = 'zenbull'

  const url = 'https://squeeth.opyn.co'
  const title = 'Opyn Zen Bull Strategy - Stack ETH'
  const description = 'Stack ETH when ETH increases slow and steady'
  const ogImageUrl =
    'https://continuouscall-git-share-pnl-with-og-opynfinance.vercel.app/api/pnl/zenbull/1667892527/-1.93'

  return (
    <>
      <Head>
        <title>Opyn Zen Bull Strategy - Stack ETH</title>
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Opyn Zen Bull Strategy - Stack ETH" />
        <meta name="twitter:description" content="Stack ETH when ETH increases slow and steady" />
        <meta name="twitter:image" content={ogImageUrl} />
        <meta property="og:image" content={ogImageUrl} />
        <title>{title}</title>
        <meta name="title" content={title} />
        <meta name="description" content={description} />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={url} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta
          property="og:image"
          content="https://continuouscall-git-share-pnl-with-og-opynfinance.vercel.app/api/pnl/zenbull/1667892527/-1.93"
        />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:url" content={url} />
        <meta property="twitter:title" content={title} />
        <meta property="twitter:description" content={description} />
        <meta
          property="twitter:image"
          content="https://continuouscall-git-share-pnl-with-og-opynfinance.vercel.app/api/pnl/zenbull/1667892527/-1.93"
        />
      </Head>

      <Box marginTop="20px" marginLeft="20px">
        <Typography variant="h3">/share-pnl page</Typography>
      </Box>
    </>
  )
}

export default SharePnl

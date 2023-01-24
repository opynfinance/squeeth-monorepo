import React from 'react'
import { Box, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { NextSeo } from 'next-seo'

import MintSqueeth from '@components/Trade/Mint'
import Nav from '@components/Nav'
import { SQUEETH_BASE_URL } from '@constants/index'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(4, 0),
    },
    title: {
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    getSqueethCard: {
      width: '440px',
      margin: 'auto',
      padding: theme.spacing(2, 0),
    },
  }),
)

const MintPage: React.FC = () => {
  const classes = useStyles()

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

      <Nav />

      <div className={classes.container}>
        <Typography align="center" variant="h6" className={classes.title}>
          Mint Squeeth
        </Typography>

        <Box className={classes.getSqueethCard}>
          <MintSqueeth onMint={() => console.log('Minted')} showManageLink />
        </Box>
      </div>
    </>
  )
}

export default MintPage

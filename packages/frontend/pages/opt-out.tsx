import React, { useEffect, useState } from 'react'
import { Box, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { setOptOut } from '@amplitude/analytics-browser'
import { NextSeo } from 'next-seo'

import { PrimaryButton } from '@components/Button'
import Nav from '@components/Nav'
import { isOptedOut } from '@utils/amplitude'
import { SQUEETH_BASE_URL } from '@constants/index'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(2),
    },
    title: {
      marginTop: theme.spacing(10),
    },
    getSqueethCard: {
      width: '300px',
      overflow: 'auto',
      margin: 'auto',
      marginTop: theme.spacing(4),
      padding: theme.spacing(2, 0),
    },
  }),
)

const MintPage: React.FC = () => {
  const classes = useStyles()
  const [optOut, setOpt] = useState(false)

  useEffect(() => {
    isOptedOut().then(setOpt)
  }, [])

  const toggleOptOut = () => {
    setOptOut(!optOut)
    setOpt(!optOut)
  }

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
      <Typography align="center" variant="h6" className={classes.title}>
        {optOut ? 'You opted out from Amplitude tracking' : 'Opt out from Amplitude tracking'}
      </Typography>
      <Box className={classes.getSqueethCard}>
        <PrimaryButton onClick={toggleOptOut}>{optOut ? 'Opt In' : 'Opt out'}</PrimaryButton>
      </Box>
    </>
  )
}

export default MintPage

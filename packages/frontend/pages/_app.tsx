import useRenderCounter from '../src/hooks/useRenderCounter'
import '../styles/globals.css'
import { ApolloProvider } from '@apollo/client'
import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/core/styles'
import * as Fathom from 'fathom-client'
import Head from 'next/head'
import { useRouter } from 'next/router'
import React, { memo, useEffect, useMemo } from 'react'
import { QueryClient, QueryClientProvider } from 'react-query'
import { ReactQueryDevtools } from 'react-query/devtools'
import { useAtomValue } from 'jotai'

import { RestrictUserProvider } from '@context/restrict-user'
import getTheme, { Mode } from '../src/theme'
import { uniswapClient } from '@utils/apollo-client'
import { useInitOnboard } from 'src/state/wallet/hooks'
import { networkIdAtom } from 'src/state/wallet/atoms'
import { useUpdateSqueethPrices, useUpdateSqueethPoolData } from 'src/state/squeethPool/hooks'
import { useInitController } from 'src/state/controller/hooks'
import { ComputeSwapsProvider } from 'src/state/positions/providers'
import { useSwaps } from 'src/state/positions/hooks'

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } })

function MyApp({ Component, pageProps }: any) {
  useRenderCounter('9', '0')

  const router = useRouter()
  const networkId = useAtomValue(networkIdAtom)
  const client = useMemo(() => uniswapClient[networkId] || uniswapClient[1], [networkId])

  React.useEffect(() => {
    // Remove the server-side injected CSS.
    const jssStyles = document.querySelector('#jss-server-side')
    if (jssStyles) {
      jssStyles.parentElement!.removeChild(jssStyles)
    }
  }, [])

  const siteID = process.env.NEXT_PUBLIC_FATHOM_CODE ? process.env.NEXT_PUBLIC_FATHOM_CODE : ''

  useEffect(() => {
    // Initialize Fathom when the app loads
    // Example: yourdomain.com
    //  - Do not include https://
    //  - This must be an exact match of your domain.
    //  - If you're using www. for your domain, make sure you include that here.
    Fathom.load(siteID, {
      includedDomains: ['squeeth.opyn.co'],
    })

    function onRouteChangeComplete() {
      Fathom.trackPageview()
    }
    // Record a pageview when route changes
    router.events.on('routeChangeComplete', onRouteChangeComplete)

    // Unassign event listener
    return () => {
      router.events.off('routeChangeComplete', onRouteChangeComplete)
    }
  }, [router.events, siteID])

  return (
    <RestrictUserProvider>
      <QueryClientProvider client={queryClient}>
        <ApolloProvider client={client}>
          <TradeApp Component={Component} pageProps={pageProps} />
        </ApolloProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </RestrictUserProvider>
  )
}

const Init = () => {
  useUpdateSqueethPrices()
  useUpdateSqueethPoolData()
  useInitController()
  useSwaps()
  return null
}
const MemoizedInit = memo(Init)

const TradeApp = ({ Component, pageProps }: any) => {
  useInitOnboard()

  return (
    <React.Fragment>
      <Head>
        <title>Squeeth</title>
        <meta
          name="description"
          content="Squeeth is a new financial primitive in DeFi that gives traders exposure to ETH²"
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Squeeth" />
        <meta
          name="twitter:description"
          content="Squeeth is a new financial primitive in DeFi that gives traders exposure to ETH²"
        />
        <meta name="twitter:image" content="https://squeeth.opyn.co/images/SqueethLogoMedium.png" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width" />
      </Head>

      <MemoizedInit />
      <ThemeProvider theme={getTheme(Mode.DARK)}>
        {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
        <CssBaseline />
        <ComputeSwapsProvider>
          <Component {...pageProps} />
        </ComputeSwapsProvider>
      </ThemeProvider>
    </React.Fragment>
  )
}

export default MyApp

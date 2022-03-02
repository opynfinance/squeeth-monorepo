import '../styles/globals.css'

import { ApolloProvider } from '@apollo/client'
import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/core/styles'
import * as Fathom from 'fathom-client'
import Head from 'next/head'
import { useRouter } from 'next/router'
import React, { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from 'react-query'
import { CookiesProvider } from 'react-cookie'
import { useAtomValue } from 'jotai'

import { RestrictUserProvider } from '@context/restrict-user'
import getTheme, { Mode } from '../src/theme'
import { uniswapClient } from '@utils/apollo-client'
import { useOnboard } from 'src/state/wallet/hooks'
import { networkIdAtom } from 'src/state/wallet/atoms'
import { useSwaps, useUpdateVaultData } from 'src/state/positions/hooks'
import { useUpdateSqueethPrices, useUpdateSqueethPoolData } from 'src/state/squeethPool/hooks'

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } })

function MyApp({ Component, pageProps }: any) {
  const router = useRouter()
  useOnboard()

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
    <CookiesProvider>
      <RestrictUserProvider>
        <QueryClientProvider client={queryClient}>
          <TradeApp Component={Component} pageProps={pageProps} />
        </QueryClientProvider>
      </RestrictUserProvider>
    </CookiesProvider>
  )
}

const Init = () => {
  useSwaps()
  useUpdateSqueethPrices()
  useUpdateSqueethPoolData()
  useUpdateVaultData()
  return null
}

const TradeApp = ({ Component, pageProps }: any) => {
  // const { networkId } = useWallet()
  const networkId = useAtomValue(networkIdAtom)

  return (
    <React.Fragment>
      <Head>
        <title>Squeeth</title>
        <meta
          name="description"
          content="Squeeth is a new financial primitive in DeFi that gives traders exposure to ETH²"
        />
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width" />
      </Head>
      <ApolloProvider client={uniswapClient[networkId] || uniswapClient[1]}>
        <Init />
        <ThemeProvider theme={getTheme(Mode.DARK)}>
          {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
          <CssBaseline />
          <Component {...pageProps} />
        </ThemeProvider>
      </ApolloProvider>
    </React.Fragment>
  )
}

export default MyApp

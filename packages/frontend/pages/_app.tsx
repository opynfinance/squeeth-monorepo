import '../styles/globals.css'

import { ApolloProvider } from '@apollo/client'
import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/core/styles'
import * as Fathom from 'fathom-client'
import Head from 'next/head'
import { useRouter } from 'next/router'
import React, { useEffect, Suspense, Fragment } from 'react'
import { QueryClient, QueryClientProvider } from 'react-query'
import { ReactQueryDevtools } from 'react-query/devtools'
import { CookiesProvider } from 'react-cookie'
import { useAtom } from 'jotai'

import { RestrictUserProvider } from '@context/restrict-user'
// import { useWallet, WalletProvider } from '@context/wallet'
import { WorldProvider } from '@context/world'
import { PositionsProvider } from '@context/positions'
import getTheme, { Mode } from '../src/theme'
import { uniswapClient } from '@utils/apollo-client'
import { useOnboard } from 'src/state/wallet/hooks'
import { networkIdAtom } from 'src/state/wallet/atoms'
import { useSwaps } from 'src/state/positions/hooks'

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } })
const isServer = typeof window === 'undefined'
const BrowserSuspense = isServer ? Fragment : Suspense

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
      {/* <WalletProvider> */}
      <RestrictUserProvider>
        <QueryClientProvider client={queryClient}>
          <TradeApp Component={Component} pageProps={pageProps} />
        </QueryClientProvider>
      </RestrictUserProvider>
      {/* </WalletProvider> */}
    </CookiesProvider>
  )
}

const Init = () => {
  useSwaps()
  return null
}

const TradeApp = ({ Component, pageProps }: any) => {
  // const { networkId } = useWallet()
  const [networkId] = useAtom(networkIdAtom)

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
          <BrowserSuspense fallback={<h1>Loading...</h1>}>
            <WorldProvider>
              <PositionsProvider>
                <Component {...pageProps} />
              </PositionsProvider>
            </WorldProvider>
          </BrowserSuspense>
        </ThemeProvider>
      </ApolloProvider>
    </React.Fragment>
  )
}

export default MyApp

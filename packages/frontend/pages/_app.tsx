import useRenderCounter from '../src/hooks/useRenderCounter'
import '../styles/globals.css'
import { ApolloProvider } from '@apollo/client'
import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/core/styles'
import * as Fathom from 'fathom-client'
import Head from 'next/head'
import { useRouter } from 'next/router'
import dynamic from 'next/dynamic'
import '@rainbow-me/rainbowkit/styles.css'
import { getDefaultWallets, RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { configureChains, createClient, WagmiConfig, useSigner, useAccount } from 'wagmi'
import { mainnet, goerli } from 'wagmi/chains'
import { infuraProvider } from 'wagmi/providers/infura'
import { publicProvider } from 'wagmi/providers/public'
import React, { memo, useEffect, useMemo, useRef } from 'react'
import { QueryClient, QueryClientProvider } from 'react-query'
import { ReactQueryDevtools } from 'react-query/devtools'
import { useAtomValue } from 'jotai'
import { RestrictUserProvider } from '@context/restrict-user'
import getTheme, { Mode } from '../src/theme'
import { uniswapClient } from '@utils/apollo-client'
import { useOnboard } from 'src/state/wallet/hooks'
import { addressAtom, connectedWalletAtom, networkIdAtom, walletFailVisibleAtom } from 'src/state/wallet/atoms'
import { useUpdateSqueethPrices, useUpdateSqueethPoolData } from 'src/state/squeethPool/hooks'
import { useInitController } from 'src/state/controller/hooks'
import { ComputeSwapsProvider } from 'src/state/positions/providers'
import { useSwaps } from 'src/state/positions/hooks'
import { useUpdateAtom } from 'jotai/utils'
import useAppEffect from '@hooks/useAppEffect'
import WalletFailModal from '@components/WalletFailModal'
import { checkIsValidAddress } from 'src/state/wallet/apis'
import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en'
import '@utils/amplitude'
import { setUserId } from '@amplitude/analytics-browser'
import { WALLET_EVENTS, initializeAmplitude } from '@utils/amplitude'
import useAmplitude from '@hooks/useAmplitude'
import CookiePopUp from '@components/CookiePopUp'
import StrategyLayout from '@components/StrategyLayout/StrategyLayout'

const CrispWithNoSSR = dynamic(() => import('../src/components/CrispChat/CrispChat'), { ssr: false })
const infuraId = process.env.NEXT_PUBLIC_INFURA_API_KEY

// Chains for connectors to support
const { chains, provider } = configureChains([goerli], [infuraProvider({ infuraId }), publicProvider()])

//Set up connectors
const { connectors } = getDefaultWallets({
  appName: 'Squeeth',
  chains,
})

const wagmiClient = createClient({
  autoConnect: false,
  connectors: [...connectors()],
  provider,
})

initializeAmplitude()

TimeAgo.addDefaultLocale(en)
const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } })

function MyApp({ Component, pageProps }: any) {
  useRenderCounter('9', '0')

  const router = useRouter()
  const { track } = useAmplitude()
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

  useEffect(() => {
    function onRouteChangeComplete(url: string) {
      const e: string = url.split('?')[0].substring(1).toUpperCase()
      track('NAV_' + e)
    }
    router.events.on('routeChangeComplete', onRouteChangeComplete)

    return () => {
      router.events.off('routeChangeComplete', onRouteChangeComplete)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track])

  return (
    <RestrictUserProvider>
      <QueryClientProvider client={queryClient}>
        <ApolloProvider client={client}>
          <WagmiConfig client={wagmiClient}>
            <RainbowKitProvider
              coolMode
              chains={chains}
              theme={darkTheme({
                accentColor: 'rgba(26, 232, 255)',
                accentColorForeground: 'black',
              })}
              appInfo={{
                appName: 'Squeeth',
              }}
              showRecentTransactions
            >
              <TradeApp Component={Component} pageProps={pageProps} />
            </RainbowKitProvider>
          </WagmiConfig>
        </ApolloProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </RestrictUserProvider>
  )
}

const Init = () => {
  const { address } = useAccount()
  const networkId = useAtomValue(networkIdAtom)
  const setConnectedWallet = useUpdateAtom(connectedWalletAtom)
  const setAddress = useUpdateAtom(addressAtom)
  const setWalletFailVisible = useUpdateAtom(walletFailVisibleAtom)
  const firstAddressCheck = useRef(true)
  const { track } = useAmplitude()

  console.log('ADDRESS connected', address)

  useAppEffect(() => {
    if (!address) {
      return setConnectedWallet(false)
    }

    checkIsValidAddress(address).then((valid) => {
      if (valid) {
        setAddress(address)
        setUserId(address)
        setConnectedWallet(!!(address && networkId))
        track(WALLET_EVENTS.WALLET_CONNECTED, { address })
      } else {
        if (firstAddressCheck.current) {
          firstAddressCheck.current = false
        } else {
          setWalletFailVisible(true)
        }
      }
    })
  }, [address, setAddress, setWalletFailVisible, setConnectedWallet, track, networkId])

  useOnboard()
  useUpdateSqueethPrices()
  useUpdateSqueethPoolData()
  useInitController()
  useSwaps()
  return null
}
const MemoizedInit = memo(Init)

const TradeApp = ({ Component, pageProps }: any) => {
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
        <meta name="twitter:image" content="https://squeeth.opyn.co/images/SqueethLogoMetadata-WhiteBg.png" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width" />
      </Head>

      <MemoizedInit />
      <ThemeProvider theme={getTheme(Mode.NEW_DARK)}>
        {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
        <CssBaseline />
        <ComputeSwapsProvider>
          <WalletFailModal />
          <StrategyLayout>
            <CrispWithNoSSR />
            <Component {...pageProps} />
          </StrategyLayout>
        </ComputeSwapsProvider>
      </ThemeProvider>
      <CookiePopUp />
    </React.Fragment>
  )
}

export default MyApp

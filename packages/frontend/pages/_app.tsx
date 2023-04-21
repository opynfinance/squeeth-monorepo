import useRenderCounter from '../src/hooks/useRenderCounter'
import '../styles/globals.css'
import { ApolloProvider } from '@apollo/client'
import CssBaseline from '@material-ui/core/CssBaseline'
import { ThemeProvider } from '@material-ui/core/styles'
import * as Fathom from 'fathom-client'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { Crisp } from 'crisp-sdk-web'
import React, { memo, useEffect, useMemo, useRef } from 'react'
import { QueryClient, QueryClientProvider } from 'react-query'
import { ReactQueryDevtools } from 'react-query/devtools'
import { useAtomValue } from 'jotai'
import { RestrictUserProvider } from '@context/restrict-user'
import getTheme, { Mode } from '../src/theme'
import { uniswapClient } from '@utils/apollo-client'
import { useOnboard, useConnectWallet } from 'src/state/wallet/hooks'
import { networkIdAtom, onboardAddressAtom, walletFailVisibleAtom } from 'src/state/wallet/atoms'
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
import { initializeAmplitude } from '@utils/amplitude'
import useAmplitude from '@hooks/useAmplitude'
import StrategyLayout from '@components/StrategyLayout/StrategyLayout'
import useTrackSiteReload from '@hooks/useTrackSiteReload'
import { hideCrispChat, showCrispChat } from '@utils/crisp-chat'
import { TOS_UPDATE_DATE } from '@constants/index'

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
      includedDomains: ['opyn.co', 'www.opyn.co'],
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

  useEffect(() => {
    Crisp.configure(process.env.NEXT_PUBLIC_CRISP_WEBSITE_ID as string)
  }, [])

  useEffect(() => {
    if (router.pathname !== '/') {
      showCrispChat()
    } else hideCrispChat()
  }, [router])

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
  const onboardAddress = useAtomValue(onboardAddressAtom)
  const setWalletFailVisible = useUpdateAtom(walletFailVisibleAtom)
  const firstAddressCheck = useRef(true)
  const router = useRouter()
  const connectWallet = useConnectWallet()

  const isZenbullPage = router.pathname === '/strategies/bull'

  useAppEffect(() => {
    if (!onboardAddress) {
      return
    }

    checkIsValidAddress(onboardAddress).then((valid) => {
      if (valid) {
        const hasConnectedAfterTosUpdate = window.localStorage.getItem(TOS_UPDATE_DATE) === 'true'
        if (!hasConnectedAfterTosUpdate) {
          return
        } else if (isZenbullPage) {
          // connect automatically (to zenbull) only if user has specifically connected to zenbull page
          const hasConnectedToZenbullBefore = window.localStorage.getItem('walletConnectedToZenbull') === 'true'
          if (hasConnectedToZenbullBefore) {
            connectWallet(onboardAddress)
          }
        } else {
          connectWallet(onboardAddress)
        }
      } else {
        if (firstAddressCheck.current) {
          firstAddressCheck.current = false
        } else {
          setWalletFailVisible(true)
        }
      }
    })
  }, [onboardAddress, setWalletFailVisible, isZenbullPage, connectWallet])

  useOnboard()
  useTrackSiteReload()
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
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width" />
      </Head>

      <MemoizedInit />
      <ThemeProvider theme={getTheme(Mode.NEW_DARK)}>
        {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
        <CssBaseline />
        <ComputeSwapsProvider>
          <WalletFailModal />
          <StrategyLayout>
            <Component {...pageProps} />
          </StrategyLayout>
        </ComputeSwapsProvider>
      </ThemeProvider>
    </React.Fragment>
  )
}

export default MyApp

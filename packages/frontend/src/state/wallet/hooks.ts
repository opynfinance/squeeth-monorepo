import { useAtom, useAtomValue } from 'jotai'
import { useResetAtom, useUpdateAtom } from 'jotai/utils'
import BigNumber from 'bignumber.js'
import Notify from 'bnc-notify'
import Onboard from 'bnc-onboard'
import Web3 from 'web3'
import { useQueryClient } from 'react-query'

import {
  onboardAtom,
  addressAtom,
  notifyAtom,
  networkIdAtom,
  supportedNetworkAtom,
  web3Atom,
  transactionDataAtom,
  transactionLoadingAtom,
  walletBalanceAtom,
} from './atoms'
import { EtherscanPrefix } from '../../constants/'
import { Networks } from '../../types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApolloClient } from '@apollo/client'
import useAppEffect from '@hooks/useAppEffect'
import { Subscriptions } from 'bnc-onboard/dist/src/interfaces'

export const useSelectWallet = () => {
  const [onboard] = useAtom(onboardAtom)

  const onWalletSelect = async () => {
    if (!onboard) return
    onboard.walletSelect().then(async (success) => {
      if (success) {
        await onboard.walletCheck()
        const wallet = onboard.getState().wallet
        window.localStorage.setItem('selectedWallet', wallet.name ?? '')
      }
    })
  }

  return onWalletSelect
}

export const useDiscconectWallet = () => {
  const [onboard] = useAtom(onboardAtom)
  // const setAddress = useUpdateAtom(addressAtom)
  // const queryClient = useQueryClient()
  // const apolloClient = useApolloClient()

  const disconnectWallet = () => {
    if (!onboard) return

    onboard.walletReset()
    // queryClient.refetchQueries()
    // apolloClient.resetStore()
  }

  return disconnectWallet
}

export const useHandleTransaction = () => {
  const [notify] = useAtom(notifyAtom)
  const [networkId] = useAtom(networkIdAtom)
  const setTransactionData = useUpdateAtom(transactionDataAtom)

  const handleTransaction = useCallback(
    (tx: any, onTxConfirmed?: () => void) => {
      if (!notify) return
      tx.on('transactionHash', (hash: string) => {
        const { emitter } = notify.hash(hash)
        //have to return the emitter object in last order, or the latter emitter object will replace the previous one
        //if call getbalance in second order, since it has no return, it will show default notification w/o etherscan link

        emitter.on('all', (transaction) => {
          if (networkId === Networks.LOCAL) return
          setTransactionData(transaction)

          if (transaction.status === 'confirmed' && onTxConfirmed) {
            onTxConfirmed()
          }

          return {
            link: `${EtherscanPrefix[networkId]}${transaction.hash}`,
          }
        })
      })

      return tx
    },
    [networkId, notify, setTransactionData],
  )

  return handleTransaction
}

export const useTransactionStatus = () => {
  const [txCancelled, setTxCancelled] = useState(false)
  const transactionData = useAtomValue(transactionDataAtom)
  const resetTransactionData = useResetAtom(transactionDataAtom)
  const transactionLoading = useAtomValue(transactionLoadingAtom)

  const confirmed = transactionData?.status === 'confirmed' && !txCancelled
  const cancelled = transactionData?.status === 'confirmed' && txCancelled

  useEffect(() => {
    if (transactionData?.status === 'cancel') {
      setTxCancelled(true)
    }
  }, [transactionData?.status])

  return useMemo(
    () => ({
      transactionData,
      confirmed,
      cancelled,
      loading: transactionLoading,
      resetTxCancelled: () => setTxCancelled(false),
      resetTransactionData,
    }),
    [cancelled, confirmed, resetTransactionData, transactionData, transactionLoading],
  )
}

export const useWalletBalance = () => {
  const walletBalance = useAtomValue(walletBalanceAtom)

  return { data: new BigNumber(walletBalance ?? '0') }
}

export function useInitOnboard() {
  const queryClient = useQueryClient()
  const apolloClient = useApolloClient()

  const [networkId, setNetworkId] = useAtom(networkIdAtom)
  const [onboard, setOnboard] = useAtom(onboardAtom)
  const setAddress = useUpdateAtom(addressAtom)
  const setSupportedNetwork = useUpdateAtom(supportedNetworkAtom)
  const setWeb3 = useUpdateAtom(web3Atom)
  const setWalletBalance = useUpdateAtom(walletBalanceAtom)
  const setNotify = useUpdateAtom(notifyAtom)

  useAppEffect(() => {
    const onboard = initOnboardSdk(
      {
        address: (address) => {
          if (address) {
            setAddress(address)
          } else {
            setAddress(null)
          }
        },
        balance: (balance) => {
          setWalletBalance(new BigNumber(balance))
        },
        network: (networkId) => {
          const network = networkId === 1337 ? 31337 : Boolean(networkId) ? networkId : Networks.MAINNET
          setNetworkId(network)

          if (network in Networks) {
            setSupportedNetwork(true)
          } else {
            setSupportedNetwork(false)
            console.log('Unsupported network')
          }
        },
        wallet: (wallet) => {
          if (wallet.name) {
            window.localStorage.setItem('selectedWallet', wallet.name ?? '')
            setWeb3(new Web3(wallet.provider))
          } else {
            window.localStorage.setItem('selectedWallet', '')
            setWeb3(null)
          }
        },
      },
      networkId,
    )

    setOnboard(onboard)
  }, [networkId, setAddress, setNetworkId, setOnboard, setSupportedNetwork, setWalletBalance, setWeb3])

  // sync all queries with networkID
  useAppEffect(() => {
    queryClient.refetchQueries()
    apolloClient.resetStore()
    setNotify(initNotify(networkId))
  }, [apolloClient, networkId, queryClient, setNotify])

  useAppEffect(() => {
    ;(async function autoConnect() {
      const previouslySelectedWallet = window.localStorage.getItem('selectedWallet')

      if (previouslySelectedWallet && onboard) {
        await onboard.walletSelect(previouslySelectedWallet)
      }
    })()
  }, [onboard])
}

const useAlchemy = process.env.NEXT_PUBLIC_USE_ALCHEMY
const usePokt = process.env.NEXT_PUBLIC_USE_POKT

export function initNotify(networkId: Networks) {
  return Notify({
    dappId: process.env.NEXT_PUBLIC_BLOCKNATIVE_DAPP_ID, // [String] The API key created by step one above
    networkId: networkId, // [Integer] The Ethereum network ID your Dapp uses.
    darkMode: true, // (default: false)
  })
}

export function initOnboardSdk(subscriptions: Subscriptions, networkId: Networks) {
  const DOMAIN = process.env.NEXT_PUBLIC_VERCEL_URL ?? 'http://localhost:3000'
  const network = networkId === 1 ? 'mainnet' : 'ropsten'
  const RPC_URL =
    networkId === Networks.LOCAL
      ? 'http://127.0.0.1:8545/'
      : networkId === Networks.ARBITRUM_RINKEBY
      ? 'https://rinkeby.arbitrum.io/rpc'
      : useAlchemy === 'true'
      ? `https://eth-${network}.alchemyapi.io/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
      : usePokt === 'true'
      ? `https://eth-${network}.gateway.pokt.network/v1/lb/${process.env.NEXT_PUBLIC_POKT_ID}`
      : `https://${network}.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_API_KEY}`

  return Onboard({
    dappId: process.env.NEXT_PUBLIC_BLOCKNATIVE_DAPP_ID,
    networkId: networkId,
    darkMode: true,
    blockPollingInterval: 4000,
    subscriptions,
    walletSelect: {
      agreement: {
        version: '1.0.0',
        termsUrl: `${DOMAIN}/terms-of-service`,
        privacyUrl: `${DOMAIN}/privacy-policy`,
      },
      description: `<div>
          <p> By connecting a wallet, you agree to the Opyn user <a href="/terms-of-service" style="color: #2CE6F9;" target="_blank">Terms of Service</a> and acknowledge that you have read and understand the Opyn <a href="/privacy-policy" style="color: #2CE6F9;" target="_blank">Privacy Policy</a>.</p>
          </div > `,

      wallets: [
        { walletName: 'metamask', preferred: true },
        { walletName: 'coinbase', preferred: true },
        {
          walletName: 'walletLink',
          rpcUrl: RPC_URL,
          preferred: true,
        },
        {
          walletName: 'walletConnect',
          preferred: true,
          rpc: {
            [networkId]: RPC_URL,
          },
        },
        {
          walletName: 'lattice',
          rpcUrl: RPC_URL,
          preferred: true,
          appName: 'Opyn V2',
        },
        {
          walletName: 'ledger',
          preferred: true,
          rpcUrl: RPC_URL,
        },
        {
          walletName: 'gnosis',
          appName: 'WalletConnect',
        },
      ],
    },
    walletCheck: [
      { checkName: 'derivationPath' },
      { checkName: 'connect' },
      { checkName: 'accounts' },
      { checkName: 'network' },
      { checkName: 'balance', minimumBalance: '0' },
    ],
  })
}

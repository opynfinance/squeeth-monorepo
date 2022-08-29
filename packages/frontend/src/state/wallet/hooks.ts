import { useAtom, useAtomValue } from 'jotai'
import { useResetAtom, useUpdateAtom } from 'jotai/utils'
import BigNumber from 'bignumber.js'
import Notify from 'bnc-notify'
import Onboard from 'bnc-onboard'
import Web3 from 'web3'
import { ethers } from 'ethers'
import { useQuery, useQueryClient } from 'react-query'

import {
  onboardAtom,
  addressAtom,
  notifyAtom,
  networkIdAtom,
  supportedNetworkAtom,
  signerAtom,
  web3Atom,
  transactionDataAtom,
  transactionLoadingAtom,
  onboardAddressAtom,
  walletFailVisibleAtom,
} from './atoms'
import { BIG_ZERO, EtherscanPrefix } from '../../constants/'
import { Networks } from '../../types'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApolloClient } from '@apollo/client'
import useAppCallback from '@hooks/useAppCallback'
import useAppEffect from '@hooks/useAppEffect'
import { checkIsValidAddress } from './apis'

export const useSelectWallet = () => {
  const [onboard] = useAtom(onboardAtom)
  const setAddress = useUpdateAtom(addressAtom)
  const onboardAddress = useAtomValue(onboardAddressAtom)
  const setWalletFailVisible = useUpdateAtom(walletFailVisibleAtom)

  const onWalletSelect = async () => {
    if (!onboard) return
    onboard.walletSelect().then(async (success) => {
      if (success) {
        // if onboard address is invalid
        if (onboardAddress) {
          checkIsValidAddress(onboardAddress).then((valid) => {
            if (valid) {
              setAddress(onboardAddress)
            } else {
              setWalletFailVisible(true)
            }
          })
        }

        await onboard.walletCheck()
      }
    })
  }

  return onWalletSelect
}

export const useDiscconectWallet = () => {
  const [onboard] = useAtom(onboardAtom)
  const setAddress = useUpdateAtom(addressAtom)
  const setOnboardAddress = useUpdateAtom(onboardAddressAtom)
  const queryClient = useQueryClient()
  const apolloClient = useApolloClient()

  const disconnectWallet = () => {
    if (!onboard) return
    onboard.walletReset()
    window.localStorage.setItem('walletAddress', '')
    setAddress(null)
    setOnboardAddress(null)
    queryClient.setQueryData('userWalletBalance', BIG_ZERO)
    queryClient.removeQueries()
    apolloClient.clearStore()
  }

  return disconnectWallet
}

export const useHandleTransaction = () => {
  const [notify] = useAtom(notifyAtom)
  const [networkId] = useAtom(networkIdAtom)
  const { refetch } = useWalletBalance()
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

          if (transaction.status === 'confirmed') {
            if (onTxConfirmed) {
              onTxConfirmed()
            }
            refetch()
          }

          return {
            link: `${EtherscanPrefix[networkId]}${transaction.hash}`,
          }
        })
      })

      return tx
    },
    [networkId, notify, refetch, setTransactionData],
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

const balanceQueryKeys = {
  userWalletBalance: (address: string) => ['userWalletBalance', { address }],
}
export const useWalletBalance = () => {
  const [address] = useAtom(addressAtom)
  const [web3] = useAtom(web3Atom)

  return useQuery(balanceQueryKeys.userWalletBalance(address ?? ''), () => getBalance(web3, address), {
    enabled: Boolean(address),
    refetchInterval: 30000,
  })
}

export const useOnboard = () => {
  const setSupportedNetwork = useUpdateAtom(supportedNetworkAtom)
  const [networkId, setNetworkId] = useAtom(networkIdAtom)
  const [onboard, setOnboard] = useAtom(onboardAtom)
  const address = useAtomValue(addressAtom)
  const setOnboardAddress = useUpdateAtom(onboardAddressAtom)
  const setWeb3 = useUpdateAtom(web3Atom)
  const setSigner = useUpdateAtom(signerAtom)
  const setNotify = useUpdateAtom(notifyAtom)
  const queryClient = useQueryClient()
  const apolloClient = useApolloClient()
  const { refetch: refetchWalletBalance } = useWalletBalance()

  const onNetworkChange = useAppCallback(
    (updateNetwork: number) => {
      if (updateNetwork in Networks) {
        setNetworkId(updateNetwork)
        setSupportedNetwork(true)
        queryClient.refetchQueries()
        apolloClient.resetStore()
        refetchWalletBalance()

        if (onboard !== null) {
          const network = updateNetwork === 1337 ? 31337 : updateNetwork
          // localStorage.setItem('networkId', network.toString())
          onboard.config({
            networkId: network,
          })
        }
      } else {
        setSupportedNetwork(false)
        if (address === null || onboard === null) return
        onboard.walletCheck()
        console.log('Unsupported network')
      }
    },
    [setNetworkId, setSupportedNetwork, queryClient, apolloClient, refetchWalletBalance, onboard, address],
  )

  const onWalletUpdate = useAppCallback(
    (wallet: any) => {
      if (wallet.provider) {
        window.localStorage.setItem('selectedWallet', wallet.name)
        const provider = new ethers.providers.Web3Provider(wallet.provider)
        provider.pollingInterval = 30000
        setWeb3(new Web3(wallet.provider))
        setSigner(provider.getSigner())
      }
    },
    [setSigner, setWeb3],
  )

  useAppEffect(() => {
    const onboard = initOnboard(
      {
        address: setOnboardAddress,
        network: onNetworkChange,
        wallet: onWalletUpdate,
      },
      networkId,
    )

    setOnboard(onboard)
    setNotify(initNotify(networkId))

    // removed it for whitelist checking
    const previouslySelectedWallet = window.localStorage.getItem('selectedWallet')

    if (previouslySelectedWallet && onboard) {
      onboard.walletSelect(previouslySelectedWallet).then((success) => {
        console.log('Connected to wallet', success)
      })
    }
  }, [networkId])
}
const useAlchemy = process.env.NEXT_PUBLIC_USE_ALCHEMY
const usePokt = process.env.NEXT_PUBLIC_USE_POKT
export function initOnboard(subscriptions: any, networkId: Networks) {
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
    blockPollingInterval: 30000,
    subscriptions: subscriptions,
    walletSelect: {
      description: `<div>
          <p> By connecting a wallet, you agree to the Opyn user <a href="/terms-of-service" style="color: #2CE6F9;" target="_blank">Terms of Service</a> and acknowledge that you have read and understand the Opyn <a href="/privacy-policy" style="color: #2CE6F9;" target="_blank">Privacy Policy</a>. Our Terms of Service and Opyn Privacy Policy were last updated on August 25, 2022.</p>
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
    // walletCheck: [networkCheckResult],
    walletCheck: [
      { checkName: 'derivationPath' },
      { checkName: 'connect' },
      { checkName: 'accounts' },
      { checkName: 'network' },
    ],
  })
}

export function initNotify(networkId: Networks) {
  return Notify({
    dappId: process.env.NEXT_PUBLIC_BLOCKNATIVE_DAPP_ID, // [String] The API key created by step one above
    networkId: networkId, // [Integer] The Ethereum network ID your Dapp uses.
    darkMode: true, // (default: false)
  })
}

async function getBalance(web3: Web3, address: string | null) {
  try {
    if (!address) return
    const balance = await web3.eth.getBalance(address)
    return new BigNumber(balance)
  } catch {
    return new BigNumber(0)
  }
}

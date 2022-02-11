import Onboard from 'bnc-onboard'
import Notify from 'bnc-notify'
import BigNumber from 'bignumber.js'
import { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { ethers } from 'ethers'
import Web3 from 'web3'
import { useAppSelector } from '@hooks/useAppSelector'
import { setWeb3Settings, setAddress } from './actions'
import { Networks } from '../../types'
import useInterval from '@hooks/useInterval'
import { POLLING_INTERVAL } from '@constants/index'

export default function Updater(): null {
  const dispatch = useDispatch()
  const networkId = useAppSelector(({ wallet }) => wallet.networkId)
  const _onboard = useAppSelector(({ wallet }) => wallet.onboard)
  const web3 = useAppSelector(({ wallet }) => wallet.web3)
  const address = useAppSelector(({ wallet }) => wallet.address)

  const onNetworkChange = (updateNetwork: number) => {
    if (updateNetwork in Networks) {
      dispatch(setWeb3Settings({ networkId: updateNetwork as Networks }))
      if (_onboard) {
        const network = updateNetwork === 1337 ? 31337 : updateNetwork
        localStorage.setItem('networkId', network.toString())
        _onboard.config({
          networkId: network,
        })
      }
    } else {
      if (address === null || !_onboard) return
      _onboard.walletCheck()
      console.log('Unsupported network')
    }
  }

  const onWalletUpdate = (wallet: any) => {
    if (wallet.provider) {
      window.localStorage.setItem('selectedWallet', wallet.name)
      const provider = new ethers.providers.Web3Provider(wallet.provider)
      provider.pollingInterval = POLLING_INTERVAL
      dispatch(setWeb3Settings({ web3: new Web3(wallet.provider), signer: () => provider.getSigner() }))
    }
  }

  const getBalance = () => {
    if (!address) {
      dispatch(setWeb3Settings({ balance: new BigNumber(0) }))
      return
    }

    web3.eth.getBalance(address).then((bal) => dispatch(setWeb3Settings({ balance: new BigNumber(bal) })))
  }

  const useAlchemy = process.env.NEXT_PUBLIC_USE_ALCHEMY
  const network = networkId === 1 ? 'mainnet' : 'ropsten'
  const RPC_URL =
    networkId === Networks.LOCAL
      ? 'http://127.0.0.1:8545/'
      : networkId === Networks.ARBITRUM_RINKEBY
      ? 'https://rinkeby.arbitrum.io/rpc'
      : useAlchemy
      ? `https://eth-${network}.alchemyapi.io/v2/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
      : `https://${network}.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_API_KEY}`

  useEffect(() => {
    if (!address) {
      dispatch(setWeb3Settings({ balance: new BigNumber(0) }))
      return
    }
    getBalance()
  }, [address])

  useInterval(getBalance, POLLING_INTERVAL)

  useEffect(() => {
    const onboard = Onboard({
      dappId: process.env.NEXT_PUBLIC_BLOCKNATIVE_DAPP_ID,
      networkId: networkId,
      darkMode: true,
      blockPollingInterval: POLLING_INTERVAL,
      subscriptions: {
        address: (address) => dispatch(setAddress(address)),
        network: onNetworkChange,
        wallet: onWalletUpdate,
        // balance: (balance) => setBalance(new BigNumber(balance)),
      },
      walletSelect: {
        description: `<div>
          <p> By connecting a wallet, you agree to the Opyn user <a href="/terms-of-service" style="color: #2CE6F9;" target="_blank">Terms of Service</a> and acknowledge that you have read and understand the Opyn <a href="/privacy-policy" style="color: #2CE6F9;" target="_blank">Privacy Policy</a>.</p>
          </div > `,

        wallets: [
          { walletName: 'metamask', preferred: true },
          { walletName: 'coinbase', preferred: false },
          {
            walletName: 'walletLink',
            rpcUrl: RPC_URL,
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

    const notify = Notify({
      dappId: process.env.NEXT_PUBLIC_BLOCKNATIVE_DAPP_ID, // [String] The API key created by step one above
      networkId: networkId, // [Integer] The Ethereum network ID your Dapp uses.
      darkMode: true, // (default: false)
    })

    dispatch(setWeb3Settings({ onboard, notify }))

    // removed it for whitelist checking
    const previouslySelectedWallet = window.localStorage.getItem('selectedWallet')

    if (previouslySelectedWallet && onboard) {
      onboard.walletSelect(previouslySelectedWallet).then((success) => {
        console.log('Connected to wallet', success)
      })
    }
  }, [networkId])

  useEffect(() => {
    const previouslySelectedWallet = window.localStorage ? window.localStorage.getItem('selectedWallet') : undefined

    if (previouslySelectedWallet && _onboard && !['WalletLink', 'Coinbase'].includes(previouslySelectedWallet)) {
      _onboard.walletSelect(previouslySelectedWallet)
    }
  }, [_onboard, dispatch, web3])

  return null
}

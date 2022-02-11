import { useCallback } from 'react'
import { useAppSelector } from '../../hooks/useAppSelector'
import { useAppDispatch } from '../../hooks/useAppDispatch'
import { setAddress as _setAddress, setWeb3Settings } from './actions'
import BigNumber from 'bignumber.js'
import { EtherscanPrefix } from '../../constants'
import { Networks } from '../../types'

export function useNotify() {
  const notify = useAppSelector(({ wallet }) => wallet.notify)
  return notify
}

export function useDisconnect() {
  const dispatch = useAppDispatch()
  const onboard = useAppSelector(({ wallet }) => wallet.onboard)
  const disconnect = useCallback(async () => {
    if (!onboard) return
    await onboard.walletReset()
    dispatch(
      setWeb3Settings({
        web3: undefined,
        balance: new BigNumber(0),
      }),
    )
    dispatch(_setAddress(null))
  }, [dispatch, onboard])

  return disconnect
}

export function useWalletSelect() {
  const onboard = useAppSelector(({ wallet }) => wallet.onboard)
  const onWalletSelect = useCallback(async () => {
    if (!onboard) return
    onboard.walletSelect().then((success) => {
      if (success) onboard.walletCheck()
    })
  }, [onboard])
  return onWalletSelect
}

export function useHandleTransaction() {
  const web3 = useAppSelector(({ wallet }) => wallet.web3)
  const notify = useAppSelector(({ wallet }) => wallet.notify)
  const networkId = useAppSelector(({ wallet }) => wallet.networkId)
  const address = useAppSelector(({ wallet }) => wallet.address)
  const dispatch = useAppDispatch()
  const addEtherscan = (transaction: any) => {
    if (networkId === Networks.LOCAL) return
    return {
      link: `${EtherscanPrefix[networkId]}${transaction.hash}`,
    }
  }
  const getBalance = () => {
    if (!address) {
      dispatch(setWeb3Settings({ balance: new BigNumber(0) }))
      return
    }

    web3.eth.getBalance(address).then((bal) => dispatch(setWeb3Settings({ balance: new BigNumber(bal) })))
  }
  const handleTransaction = (tx: any) => {
    if (!notify) return
    tx.on('transactionHash', (hash: string) => {
      const { emitter } = notify.hash(hash)
      //have to return the emitter object in last order, or the latter emitter object will replace the previous one
      //if call getbalance in second order, since it has no return, it will show default notification w/o etherscan link
      emitter.on('all', getBalance)
      emitter.on('all', addEtherscan)
    })

    return tx
  }
  return handleTransaction
}

export function useOnboard() {
  const onboard = useAppSelector(({ wallet }) => wallet.onboard)
  return onboard
}

export const useAddress = () => {
  const dispatch = useAppDispatch()
  const address = useAppSelector(({ wallet }) => wallet.address)

  const setAddress = (address: string | null) => dispatch(_setAddress(address))

  return { address, setAddress }
}

export const useNetworkId = () => {
  const dispatch = useAppDispatch()
  const networkId = useAppSelector(({ wallet }) => wallet.networkId)

  const setNetworkId = (networkId: Networks) => dispatch(setWeb3Settings({ networkId }))

  return { networkId, setNetworkId }
}

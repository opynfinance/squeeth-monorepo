import BigNumber from 'bignumber.js'
import { useCallback, useEffect, useState } from 'react'
import { Contract } from 'web3-eth-contract'

import erc20Abi from '../../abis/erc20.json'
import { toTokenAmount } from '@utils/calculations'
import { useIntervalAsync } from '@hooks/useIntervalAsync'
import { useAddress, useConnected } from 'src/state/wallet/hooks'
import useAppSelector from '@hooks/useAppSelector'

/**
 * get token balance.
 * @param token token address
 * @param refetchIntervalSec refetch interval in seconds
 * @returns {BigNumber} raw balance
 */
export const useTokenBalance = (token: string, refetchIntervalSec = 30, decimals = 18): BigNumber => {
  const [balance, setBalance] = useState(new BigNumber(0))
  const [contract, setContract] = useState<Contract>()

  const { address } = useAddress()
  const web3 = useAppSelector(({ wallet }) => wallet.web3)
  const connected = useConnected()

  useEffect(() => {
    if (!web3 || !token) return
    setContract(new web3.eth.Contract(erc20Abi as any, token))
  }, [web3, token])

  const updateBalance = useCallback(async () => {
    if (!token || !connected || !contract) return

    const _bal = await contract.methods.balanceOf(address).call({
      from: address,
    })
    const balance = toTokenAmount(new BigNumber(_bal.toString()), decimals)

    setBalance(balance)
  }, [address, connected, contract, decimals, token])

  useEffect(() => {
    updateBalance()
  }, [updateBalance])

  useIntervalAsync(updateBalance, refetchIntervalSec * 15000)

  return balance
}

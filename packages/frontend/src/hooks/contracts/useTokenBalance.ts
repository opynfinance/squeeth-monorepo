import BigNumber from 'bignumber.js'
import { useCallback, useEffect, useState } from 'react'
import { Contract } from 'web3-eth-contract'

import erc20Abi from '../../abis/erc20.json'
import { useWallet } from '../../context/wallet'
import { toTokenAmount } from '../../utils/calculations'
import useInterval from '../useInterval'

/**
 * get token balance.
 * @param token token address
 * @param refetchIntervalSec refetch interval in seconds
 * @returns {BigNumber} raw balance
 */
export const useTokenBalance = (token: string, refetchIntervalSec = 20, decimals = 18): BigNumber => {
  const [balance, setBalance] = useState(new BigNumber(0))
  const [contract, setContract] = useState<Contract>()

  const { address, web3, networkId, connected } = useWallet()

  useEffect(() => {
    if (!web3 || !token) return
    setContract(new web3.eth.Contract(erc20Abi as any, token))
  }, [web3, token])

  useEffect(() => {
    updateBalance()
  }, [address, token, contract])

  const getBalance = useCallback(async () => {
    if (!contract || !connected) return balance

    const _bal = await contract.methods.balanceOf(address).call({
      from: address,
    })
    return toTokenAmount(new BigNumber(_bal.toString()), decimals)
  }, [contract, connected])

  const updateBalance = useCallback(async () => {
    if (!token) return
    if (!connected) return
    const balance = await getBalance()
    setBalance(balance)
  }, [address, token, getBalance])

  useInterval(updateBalance, refetchIntervalSec * 1000)

  return balance
}

import BigNumber from 'bignumber.js'
import { useCallback, useEffect, useState } from 'react'
import { usePrevious } from 'react-use'
import { Contract } from 'web3-eth-contract'
import { useQuery } from 'react-query'
import { useAtomValue } from 'jotai'

import erc20Abi from '../../abis/erc20.json'
import { toTokenAmount } from '@utils/calculations'
import { addressAtom, connectedWalletAtom, web3Atom } from 'src/state/wallet/atoms'
interface TokenQueryKeyParams {
  token: string
  connected: boolean
  address: string | null
  decimals: number
  refetchIntervalSec: number
}
const tokenBalanceQueryKeys = {
  userTokenBalance: (params: TokenQueryKeyParams) => ['userTokenBalance', params],
}
/**
 * get token balance.
 * @param token token address
 * @param refetchIntervalSec refetch interval in seconds
 * @returns {BigNumber} raw balance
 */
export const useTokenBalance = (token: string, refetchIntervalSec = 30, decimals = 18) => {
  const [contract, setContract] = useState<Contract>()
  const [poll, setPoll] = useState(false)

  const web3 = useAtomValue(web3Atom)
  const address = useAtomValue(addressAtom)
  const connected = useAtomValue(connectedWalletAtom)

  useEffect(() => {
    if (!web3 || !token) return
    setContract(new web3.eth.Contract(erc20Abi as any, token))
  }, [web3, token])

  // console.log("address", address)
  // console.log("connected", connected)
  // console.log("decimals", decimals)
  // console.log("refetchIntervalSec", refetchIntervalSec)
  // console.log("token", token)
  // console.log("contract", contract)
  // console.log("boolean", Boolean(token) && Boolean(connected) && Boolean(contract))
  // console.log("web3", web3)
  // console.log("poll", poll)
  // console.log("query", tokenBalanceQueryKeys.userTokenBalance({ address, connected, decimals, refetchIntervalSec, token }))
  // console.log("update", updateBalance(token, connected, contract, address, decimals))
  
  const balanceQuery = useQuery(
    tokenBalanceQueryKeys.userTokenBalance({ address, connected, decimals, refetchIntervalSec, token }),
    () => updateBalance(token, connected, contract, address, decimals),
    {
      enabled: Boolean(token) && Boolean(connected) && Boolean(contract),
      refetchInterval: poll ? 500 : refetchIntervalSec * 15000,
    },
  )

  const prevBalance = usePrevious(balanceQuery.data?.toString())

  useEffect(() => {
    if (poll && prevBalance !== balanceQuery.data?.toString()) {
      // setPoll(false)
    }
  }, [balanceQuery.data?.toString(), poll, prevBalance])

  const refetch = useCallback(() => setPoll(true), [])

  return {
    value: balanceQuery.data ?? new BigNumber(0),
    loading: balanceQuery.isLoading || balanceQuery.isRefetching || poll,
    error: balanceQuery.error || balanceQuery.isRefetchError || !balanceQuery.data,
    refetch,
  }
}

async function updateBalance(
  token: string,
  connected: boolean,
  contract: Contract | undefined,
  address: string | null,
  decimals: number,
) {
  try {
    if (!token || !connected || !contract) return
    const _bal = await contract.methods.balanceOf(address).call()
    console.log("made it in")
    const balance = toTokenAmount(new BigNumber(_bal.toString()), decimals)
    console.log("balance", balance.toString())
    return balance
  } catch (error) {
    console.log("error", error)
    return new BigNumber(0)
  }
}

import BigNumber from 'bignumber.js'
import { useEffect, useState } from 'react'
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
      setPoll(false)
    }
  }, [balanceQuery.data?.toString(), poll, prevBalance])

  return {
    value: balanceQuery.data ?? new BigNumber(0),
    loading: balanceQuery.isLoading || balanceQuery.isRefetching || poll,
    error: balanceQuery.error || balanceQuery.isRefetchError || !balanceQuery.data,
    refetch: () => setPoll(true),
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
    const _bal = await contract.methods.balanceOf(address).call({
      from: address,
    })
    const balance = toTokenAmount(new BigNumber(_bal.toString()), decimals)

    return balance
  } catch (error) {
    return new BigNumber(0)
  }
}

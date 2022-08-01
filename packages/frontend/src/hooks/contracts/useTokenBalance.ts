import BigNumber from 'bignumber.js'
import { useCallback, useEffect, useState } from 'react'
import { usePrevious } from 'react-use'
import { Contract } from 'web3-eth-contract'
import { useQuery } from 'react-query'
import { useAtomValue } from 'jotai'

import erc20Abi from '../../abis/erc20.json'
import { toTokenAmount } from '@utils/calculations'
import { addressAtom, connectedWalletAtom, networkIdAtom, web3Atom } from 'src/state/wallet/atoms'

interface TokenQueryKeyParams {
  token: string
  connected: boolean
  address: string | null
  decimals: number
  refetchIntervalSec: number
  network: number
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
  const [poll, setPoll] = useState(false)

  const web3 = useAtomValue(web3Atom)
  const address = useAtomValue(addressAtom)
  const connected = useAtomValue(connectedWalletAtom)
  const network = useAtomValue(networkIdAtom)

  // Contract being state mess up if the network is ropsten
  // It take one rerender to update the correct contract ie) mainnet => ropsten
  // updateBalance returns 0 as it use mainnet contract. Since it's useQuery the value is cached always
  const contract = new web3.eth.Contract(erc20Abi as any, token)

  const balanceQuery = useQuery(
    tokenBalanceQueryKeys.userTokenBalance({ address, connected, decimals, refetchIntervalSec, token, network }),
    () => updateBalance(token, connected, contract, address, decimals),
    {
      enabled: Boolean(token) && Boolean(connected) && Boolean(contract),
      refetchInterval: poll ? 500 : refetchIntervalSec * 15000,
    },
  )

  const prevBalance = usePrevious(balanceQuery.data?.toString())

  useEffect(() => {
    if (poll && prevBalance && balanceQuery.data && prevBalance !== balanceQuery.data?.toString()) {
      setPoll(false)
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
  if (!token || !connected || !contract) return
  const _bal = await contract.methods.balanceOf(address).call({
    from: address,
  })
  const balance = toTokenAmount(new BigNumber(_bal.toString()), decimals)

  return balance
}

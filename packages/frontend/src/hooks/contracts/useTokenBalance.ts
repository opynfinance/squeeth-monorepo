import BigNumber from 'bignumber.js'
import { useEffect, useState } from 'react'
import { Contract } from 'web3-eth-contract'
import { useQuery } from 'react-query'
import { useAtomValue } from 'jotai'

import erc20Abi from '../../abis/erc20.json'
import { toTokenAmount } from '@utils/calculations'
// import { useIntervalAsync } from '@hooks/useIntervalAsync'
import { addressAtom, connectedWalletAtom, web3Atom } from 'src/state/wallet/atoms'

const tokenBalanceQueryKeys = {
  userTokenBalance: (token: string) => ['userTokenBalance', token],
}
/**
 * get token balance.
 * @param token token address
 * @param refetchIntervalSec refetch interval in seconds
 * @returns {BigNumber} raw balance
 */
export const useTokenBalance = (token: string, refetchIntervalSec = 30, decimals = 18) => {
  const [contract, setContract] = useState<Contract>()

  const web3 = useAtomValue(web3Atom)
  const address = useAtomValue(addressAtom)
  const connected = useAtomValue(connectedWalletAtom)

  useEffect(() => {
    if (!web3 || !token) return
    setContract(new web3.eth.Contract(erc20Abi as any, token))
  }, [web3, token])

  const balanceQuery = useQuery(
    tokenBalanceQueryKeys.userTokenBalance(token),
    () => updateBalance(token, connected, contract, address, decimals),
    {
      enabled: Boolean(token) && Boolean(connected) && Boolean(contract),
      refetchInterval: refetchIntervalSec * 15000,
      staleTime: 15000,
    },
  )

  return { value: balanceQuery.data ?? new BigNumber(0), loading: !balanceQuery.data }
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

import { useQuery } from '@apollo/client'
import { ACCOUNTS_QUERY } from '@queries/squeeth/accountsQuery'
import { accounts, accountsVariables } from '@queries/squeeth/__generated__/accounts'
import { squeethClient } from '@utils/apollo-client'
import { useAtom, useAtomValue } from 'jotai'
import { useUpdateAtom } from 'jotai/utils'

import { accountAtom, lpPositionAtom, positionAtom, accShortAmountAtom } from 'src/state/positions/atoms'
import { addressAtom, networkIdAtom } from 'src/state/wallet/atoms'
import useAppEffect from './useAppEffect'

export default function useAccounts() {
  const address = useAtomValue(addressAtom)
  const networkId = useAtomValue(networkIdAtom)
  const setAccount = useUpdateAtom(accountAtom)
  const [position, setPosition] = useAtom(positionAtom)
  const [lpposition, setLPposition] = useAtom(lpPositionAtom)
  const [accShortAmount, setAccShortAmountAtom] = useAtom(accShortAmountAtom)

  const { data, loading, refetch, startPolling, stopPolling } = useQuery<accounts, accountsVariables>(ACCOUNTS_QUERY, {
    variables: { ownerId: address! },
    client: squeethClient[networkId],
    skip: !address,
  })

  useAppEffect(() => {
    setAccount(data?.accounts)
    setLPposition(data?.accounts[0].lppositions[0])
    setPosition(data?.accounts[0].positions[0])
    setAccShortAmountAtom(data?.accounts[0]?.accShortAmount)
  }, [
    data?.accounts,
    data?.accounts[0].positions[0],
    data?.accounts[0].lppositions[0],
    setAccShortAmountAtom,
    setAccount,
    setLPposition,
    setPosition,
  ])

  return {
    accShortAmount: accShortAmount,
    positions: position,
    lpPositions: lpposition,
    loading,
    refetch,
    startPolling,
    stopPolling,
  }
}

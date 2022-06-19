import { useQuery } from '@apollo/client'
import { ACCOUNTS_QUERY } from '@queries/squeeth/accountsQuery'
import {
  accounts,
  accountsVariables,
  accounts_accounts_positions,
  accounts_accounts_lppositions,
} from '@queries/squeeth/__generated__/accounts'
import { squeethClient } from '@utils/apollo-client'
import BigNumber from 'bignumber.js'
import { useAtom, useAtomValue } from 'jotai'
import { accountAtom, lpPositionAtom, positionAtom, initPosition, accShortAmountAtom } from 'src/state/positions/atoms'
import { addressAtom, networkIdAtom } from 'src/state/wallet/atoms'
import { PositionType } from 'src/types'
import useAppEffect from './useAppEffect'

export default function useAccounts() {
  const address = useAtomValue(addressAtom)
  const networkId = useAtomValue(networkIdAtom)
  const [account, setAccount] = useAtom(accountAtom)
  const [position, setPosition] = useAtom(positionAtom)
  const [lpposition, setLPposition] = useAtom(lpPositionAtom)
  const [accShortAmount, setAccShortAmountAtom] = useAtom(accShortAmountAtom)

  const { data, loading, refetch } = useQuery<accounts, accountsVariables>(ACCOUNTS_QUERY, {
    variables: { ownerId: address! },
    client: squeethClient[networkId],
    skip: !address,
  })

  useAppEffect(() => {
    setAccount(data?.accounts)
    setLPposition(data?.accounts[0].lppositions[0])
    setPosition(data?.accounts[0].positions[0])
    setAccShortAmountAtom(data?.accounts[0]?.accShortAmount)
  }, [data?.accounts, setAccShortAmountAtom, setAccount, setLPposition, setPosition])


  return {
    accShortAmount: accShortAmount,
    positions: position,
    lpPositions: lpposition,
    loading,
    refetch,
  }
}

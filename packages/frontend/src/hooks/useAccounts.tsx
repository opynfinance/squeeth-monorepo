import { useQuery } from '@apollo/client'
import { ACCOUNTS_QUERY } from '@queries/squeeth/accountsQuery'
import {
  accounts,
  accountsVariables,
  accounts_accounts_positions,
  accounts_accounts_lppositions,
} from '@queries/squeeth/__generated__/accounts'
import { squeethClient } from '@utils/apollo-client'
import { useAtomValue } from 'jotai'
import { addressAtom, networkIdAtom } from 'src/state/wallet/atoms'

export default function useAccounts() {
  const address = useAtomValue(addressAtom)
  const networkId = useAtomValue(networkIdAtom)

  const { data: { accounts } = {} } = useQuery<accounts, accountsVariables>(ACCOUNTS_QUERY, {
    variables: { ownerId: address! },
    client: squeethClient[networkId],
    skip: !address,
  })

  return {
    positions: (accounts ? accounts[0]?.positions[0] : []) as accounts_accounts_positions,
    lpPosition: (accounts ? accounts[0]?.lppositions[0] : []) as accounts_accounts_lppositions,
  }
}

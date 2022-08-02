import { useQuery } from '@apollo/client'
import { ACCOUNT_QUERY, ACCOUNT_SUBSCRIPTION } from '@queries/squeeth/accountQuery'
import { account, accountVariables } from '@queries/squeeth/__generated__/account'
import { squeethClient } from '@utils/apollo-client'
import { useAtomValue } from 'jotai'
import { addressAtom, networkIdAtom } from 'src/state/wallet/atoms'
import useAppEffect from './useAppEffect'

export default function useAccount() {
  const networkId = useAtomValue(networkIdAtom)
  const address = useAtomValue(addressAtom)

  const {
    data: { account } = {},
    loading,
    subscribeToMore,
  } = useQuery<account, accountVariables>(ACCOUNT_QUERY, {
    variables: { id: address! },
    client: squeethClient[networkId],
    skip: !address,
  })

  useAppEffect(() => {
    subscribeToMore({
      document: ACCOUNT_SUBSCRIPTION,
      variables: {
        id: address!,
      },
      updateQuery(prev, { subscriptionData }) {
        if (!subscriptionData.data.account) {
          return prev
        }

        return subscriptionData.data
      },
    })
  }, [subscribeToMore, address])

  return { account, loading }
}

import { useQuery } from '@apollo/client'
import { squeethClient } from '@utils/apollo-client'
import { useWallet } from '@context/wallet'
import NORMHISTORY_QUERY from '../queries/uniswap/normHistoryQuery'

export const useNormHistory = (timeAgo: number) => {
  const { networkId } = useWallet()
  const { data, loading } = useQuery(NORMHISTORY_QUERY, {
    variables: {
      timeAgo,
    },
    client: squeethClient[networkId],
    fetchPolicy: 'cache-and-network',
  })

  return {
    data,
    loading,
  }
}

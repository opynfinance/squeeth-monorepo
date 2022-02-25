import { useQuery } from '@apollo/client'
import { squeethClient } from '@utils/apollo-client'
import { useWallet } from '@context/wallet'
import { NORMHISTORY_TIME_QUERY } from '../queries/uniswap/normHistoryQuery'
import { useEffect, useState } from 'react'

export const useNormHistoryFromTime = (timestamps: number[]) => {
  const { networkId } = useWallet()
  const [timeIndex, setTimeIndex] = useState(0)
  const [normHistory, setNormHistory] = useState<any[]>([])
  const { data, loading } = useQuery(NORMHISTORY_TIME_QUERY, {
    variables: {
      timestamp: timestamps[timeIndex],
    },
    client: squeethClient[networkId],
    fetchPolicy: 'cache-and-network',
  })

  useEffect(() => {
    if (!loading) {
      if (timeIndex >= 0 && timeIndex < timestamps.length) {
        setNormHistory([
          ...normHistory,
          data && data['normalizationFactorUpdates'] ? data['normalizationFactorUpdates'][0] : undefined,
        ])
      }
      if (timeIndex < timestamps.length - 1) {
        setTimeIndex(timeIndex + 1)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  return normHistory
}

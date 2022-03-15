import { useQuery } from '@apollo/client'
import { squeethClient } from '@utils/apollo-client'
import { useWallet } from '@context/wallet'
import NORMHISTORY_TIMESTAMP_QUERY from '../queries/uniswap/normHistoryQuery'
import { useEffect, useState } from 'react'

export const useNormHistoryFromTimestamps = (timestamps: string[] | undefined) => {
  const { networkId } = useWallet()
  const [timeIndex, setTimeIndex] = useState(0)
  const [normHistoryItems, setNormHistoryItems] = useState<any[]>([])
  const timestamp = timestamps && timestamps.length > 0 ? timestamps[timeIndex] : '0'
  const { data, loading } = useQuery(NORMHISTORY_TIMESTAMP_QUERY, {
    variables: {
      timestamp,
    },
    client: squeethClient[networkId],
    fetchPolicy: 'cache-and-network',
  })

  useEffect(() => {
    if (!loading && timestamps) {
      if (data && data['normalizationFactorUpdates'].length > 0) {
        setNormHistoryItems([...normHistoryItems, data['normalizationFactorUpdates'][0]])
        if (timeIndex < timestamps.length - 1) setTimeIndex(timeIndex + 1)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  return normHistoryItems
}

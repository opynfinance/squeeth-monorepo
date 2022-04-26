import { useQuery } from '@apollo/client'
import { squeethClient } from '@utils/apollo-client'
import { NORMHISTORY_TIMESTAMP_QUERY } from '../queries/squeeth/normHistoryQuery'
import { useEffect, useState } from 'react'
import { networkIdAtom } from 'src/state/wallet/atoms'
import { useAtomValue } from 'jotai'

export const useNormHistoryFromTimestamps = (timestamps: string[] | undefined) => {
  const networkId = useAtomValue(networkIdAtom)
  const [timeIndex, setTimeIndex] = useState(0)
  const [normHistoryItems, setNormHistoryItems] = useState<any[]>([])
  const timestamp = timestamps && timestamps.length > 0 ? Number(timestamps[timeIndex]) : 0
  const { data, loading } = useQuery(NORMHISTORY_TIMESTAMP_QUERY, {
    variables: {
      timestamp,
    },
    client: squeethClient[networkId],
    fetchPolicy: 'cache-and-network',
  })

  useEffect(() => {
    if (!loading && timestamps && timestamp > 0) {
      if (data && data['factor0'].length > 0) {
        if (data['factor1'].length > 0) {
          if (
            Math.abs(Number(data['factor1'][0].timestamp) - timestamp) >
            Math.abs(Number(data['factor0'][0].timestamp) - timestamp)
          ) {
            setNormHistoryItems([...normHistoryItems, data['factor0'][0]])
          } else {
            setNormHistoryItems([...normHistoryItems, data['factor1'][0]])
          }
        } else {
          setNormHistoryItems([...normHistoryItems, data['factor0'][0]])
        }
      } else if (data && data['factor1'].length > 0) {
        setNormHistoryItems([...normHistoryItems, data['factor1'][0]])
      }
      if (timeIndex < timestamps.length) setTimeIndex(timeIndex + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, timeIndex])

  return normHistoryItems
}

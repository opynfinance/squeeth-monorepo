import { useQuery } from '@apollo/client'
import { squeethClient } from '@utils/apollo-client'

import NORMHISTORY_QUERY from '../queries/squeeth/normHistoryQuery'
import { useEffect, useState } from 'react'
import { useAtomValue } from 'jotai'
import { networkIdAtom } from 'src/state/wallet/atoms'

export const useNormHistory = () => {
  const networkId = useAtomValue(networkIdAtom)
  const [skipCount, setSkipCount] = useState(0)
  const [normHistory, setNormHistory] = useState<any[]>([])
  const { data, loading } = useQuery(NORMHISTORY_QUERY, {
    variables: {
      skipCount,
    },
    client: squeethClient[networkId],
    fetchPolicy: 'cache-and-network',
  })

  useEffect(() => {
    if (!loading) {
      if (data && data['normalizationFactorUpdates'].length > 0) {
        const normHistoryItems = normHistory
        setNormHistory(
          normHistoryItems
            .concat(data['normalizationFactorUpdates'])
            .filter((val, ind, self) => ind === self.findIndex((item) => item.id === val.id)),
        )
        setSkipCount(skipCount + 1000)
      } else {
        setSkipCount(0)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  return normHistory
}

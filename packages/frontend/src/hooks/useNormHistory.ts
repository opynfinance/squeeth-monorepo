import { useQuery } from '@apollo/client'
import { squeethClient } from '@utils/apollo-client'

import NORMHISTORY_QUERY from '../queries/squeeth/normHistoryQuery'
import { useEffect, useRef, useState } from 'react'
import { useAtomValue } from 'jotai'
import { networkIdAtom } from 'src/state/wallet/atoms'
import {
  normalizationFactorUpdates,
  normalizationFactorUpdatesVariables,
} from '@queries/squeeth/__generated__/normalizationFactorUpdates'

export const useNormHistory = () => {
  const networkId = useAtomValue(networkIdAtom)
  const lastId = useRef('')
  const [normHistory, setNormHistory] = useState<any[]>([])
  const [fetchingComplete, setFetchingComplete] = useState(false)
  const { data, loading, refetch } = useQuery<normalizationFactorUpdates, normalizationFactorUpdatesVariables>(
    NORMHISTORY_QUERY,
    {
      variables: {
        lastID: '',
      },
      client: squeethClient[networkId],
      fetchPolicy: 'cache-and-network',
      notifyOnNetworkStatusChange: true,
    },
  )

  useEffect(() => {
    if (!loading) {
      if (data && data['normalizationFactorUpdates'].length > 0) {
        const normHistoryItems = normHistory
        setNormHistory(
          normHistoryItems
            .concat(data['normalizationFactorUpdates'])
            .filter((val, ind, self) => ind === self.findIndex((item) => item.id === val.id)),
        )
        lastId.current = data['normalizationFactorUpdates'][data['normalizationFactorUpdates'].length - 1].id

        if (data['normalizationFactorUpdates'].length === 1000) {
          refetch({ lastID: lastId.current })
        } else {
          setFetchingComplete(true)
        }
      } else {
        setFetchingComplete(true)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  return {
    normHistory,
    fetchingComplete,
  }
}

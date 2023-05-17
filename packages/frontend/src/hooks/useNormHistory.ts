import { useQuery } from '@apollo/client'
import { squeethClient } from '@utils/apollo-client'

import NORMHISTORY_QUERY, { NORMHISTORY_QUERY_BY_LAST_TIMESTAMP } from '../queries/squeeth/normHistoryQuery'
import { useEffect, useRef, useState } from 'react'
import { useAtomValue } from 'jotai'
import { networkIdAtom } from 'src/state/wallet/atoms'
import {
  normalizationFactorUpdates,
  normalizationFactorUpdatesVariables,
} from '@queries/squeeth/__generated__/normalizationFactorUpdates'
import {
  normalizationFactorUpdatesByLastTimestamp,
  normalizationFactorUpdatesByLastTimestampVariables,
} from '@queries/squeeth/__generated__/normalizationFactorUpdatesByLastTimestamp'

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

export const useNormHistoryByLastTimestamp = (shouldFetch = false) => {
  const networkId = useAtomValue(networkIdAtom)
  const lastTimestamp = useRef(0)
  const [normHistory, setNormHistory] = useState<any[]>([])
  const [fetchingComplete, setFetchingComplete] = useState(false)
  const { data, loading, refetch } = useQuery<
    normalizationFactorUpdatesByLastTimestamp,
    normalizationFactorUpdatesByLastTimestampVariables
  >(NORMHISTORY_QUERY_BY_LAST_TIMESTAMP, {
    variables: {
      lastTimestamp: 0,
    },
    client: squeethClient[networkId],
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
    skip: !shouldFetch,
  })

  useEffect(() => {
    if (!shouldFetch) {
      return
    }

    if (!loading) {
      if (data && data['normalizationFactorUpdates'].length > 0) {
        const normHistoryItems = normHistory
        setNormHistory(
          normHistoryItems
            .concat(data['normalizationFactorUpdates'])
            .filter((val, ind, self) => ind === self.findIndex((item) => item.id === val.id)),
        )
        lastTimestamp.current = Number(
          data['normalizationFactorUpdates'][data['normalizationFactorUpdates'].length - 1].timestamp,
        )

        if (data['normalizationFactorUpdates'].length === 1000) {
          refetch({ lastTimestamp: lastTimestamp.current })
        } else {
          console.log('because of 1000 length?')
          setFetchingComplete(true)
        }
      } else {
        console.log('because of empty data?')
        setFetchingComplete(true)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, shouldFetch])

  return {
    normHistory,
    fetchingComplete,
  }
}

import { useQuery } from '@apollo/client'
import { squeethClient } from '@utils/apollo-client'

import NORMHISTORY_QUERY from '../queries/squeeth/normHistoryQuery'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAtomValue } from 'jotai'
import { networkIdAtom } from 'src/state/wallet/atoms'
import { uniqBy } from 'lodash'

export const useNormHistory = () => {
  const networkId = useAtomValue(networkIdAtom)
  const skipCount = useRef(0)
  const [normHistory, setNormHistory] = useState<any[]>([])
  const { data, loading, refetch } = useQuery(NORMHISTORY_QUERY, {
    variables: {
      skipCount: skipCount.current,
    },
    client: squeethClient[networkId],
    fetchPolicy: 'cache-and-network',
  })

  useEffect(() => {
    if ((!loading && data?.['normalizationFactorUpdates']?.length) ?? 0 > 0) {
      setNormHistory(uniqBy(normHistory.concat(data['normalizationFactorUpdates']), 'id'))
      skipCount.current += 1000
      refetch({ skipCount: skipCount.current })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  return normHistory
}

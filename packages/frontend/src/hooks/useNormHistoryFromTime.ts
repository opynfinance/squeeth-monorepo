import { useQuery } from '@apollo/client'
import { squeethClient } from '@utils/apollo-client'
import { NORMHISTORY_TIME_QUERY } from '../queries/squeeth/normHistoryQuery'
import { useEffect, useState } from 'react'
import { NormHistory } from '../types'
import { updateTimestampLiveVolDB } from '@utils/pricer'
import { useAtomValue } from 'jotai'
import { networkIdAtom } from 'src/state/wallet/atoms'

export const useNormHistoryFromTime = (timestamps: number[]) => {
  const networkId = useAtomValue(networkIdAtom)
  const [timeIndex, setTimeIndex] = useState(0)
  const [dataUpdated, setDataUpdated] = useState(true)
  const { data, loading } = useQuery(NORMHISTORY_TIME_QUERY, {
    variables: {
      timestamp: timestamps[timeIndex],
      timestampOnedayAfter: timestamps[timeIndex] + 24 * 60 * 60,
    },
    client: squeethClient[networkId],
    fetchPolicy: 'cache-and-network',
  })

  useEffect(() => {
    if (timestamps.length > 0) {
      setDataUpdated(false)
    }
  }, [timestamps.length])

  useEffect(() => {
    if (!loading) {
      if (timeIndex >= 0 && timeIndex < timestamps.length) {
        ;(async () => {
          const normFactors: NormHistory[] =
            data && data['normalizationFactorUpdates'] ? data['normalizationFactorUpdates'] : []
          if (normFactors.length > 0) {
            const avgVol = normFactors.reduce((total, item) => {
              const secondsElapsed = Number(item.timestamp) - Number(item.lastModificationTimestamp)
              const deltaT = secondsElapsed / (420 * 60 * 60)
              const markIndex = 1 / Math.exp(Math.log(Number(item.newNormFactor) / Number(item.oldNormFactor)) / deltaT)
              const dayFunding = Math.log(markIndex) / 17.5
              const annualVol = (dayFunding < 0 ? -1 : 1) * Math.sqrt(Math.abs(dayFunding) * 365)
              return total + annualVol / normFactors.length
            }, 0)
            await updateTimestampLiveVolDB(timestamps[timeIndex], avgVol)
          }
          if (timeIndex === timestamps.length - 1) {
            setDataUpdated(true)
          } else {
            setTimeIndex(timeIndex + 1)
          }
        })()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  return dataUpdated
}

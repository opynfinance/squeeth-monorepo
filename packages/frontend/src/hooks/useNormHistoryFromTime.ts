import { useQuery } from '@apollo/client'
import { squeethClient } from '@utils/apollo-client'
import { useWallet } from '@context/wallet'
import { NORMHISTORY_TIME_QUERY } from '../queries/uniswap/normHistoryQuery'
import { useEffect, useState } from 'react'
import { NormHistory } from '../types'
import { updateTimestampLiveVolDB } from '@utils/pricer'

export const useNormHistoryFromTime = (timestamps: number[]) => {
  const { networkId } = useWallet()
  const [timeIndex, setTimeIndex] = useState(0)
  const [dataUpdated, setDataUpdated] = useState(false)
  const { data, loading } = useQuery(NORMHISTORY_TIME_QUERY, {
    variables: {
      timestamp: timestamps[timeIndex],
      timestampOnedayAfter: timestamps[timeIndex] + 24 * 60 * 60,
    },
    client: squeethClient[networkId],
    fetchPolicy: 'cache-and-network',
  })

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
          setDataUpdated(true)
        })()
      }
      if (timeIndex < timestamps.length - 1 && dataUpdated) {
        setTimeIndex(timeIndex + 1)
        setDataUpdated(false)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  return dataUpdated
}

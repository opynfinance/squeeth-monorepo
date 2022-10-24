import { gql } from '@apollo/client'

const NORMHISTORY_QUERY = gql`
  query normalizationFactorUpdates($skipCount: Int) {
    normalizationFactorUpdates(first: 1000, skip: $skipCount, orderBy: timestamp) {
      id
      oldNormFactor
      newNormFactor
      lastModificationTimestamp
      timestamp
    }
  }
`

export const NORMHISTORY_TIME_QUERY = gql`
  query normalizationFactorUpdatesTime($timestamp: Int, $timestampOnedayAfter: Int) {
    normalizationFactorUpdates(where: { timestamp_gte: $timestamp, timestamp_lt: $timestampOnedayAfter }) {
      id
      oldNormFactor
      newNormFactor
      lastModificationTimestamp
      timestamp
    }
  }
`

export default NORMHISTORY_QUERY

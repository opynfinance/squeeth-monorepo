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
  query normalizationFactorUpdates($timestamp: Int) {
    normalizationFactorUpdates(
      first: 1
      where: { lastModificationTimestamp_lte: $timestamp, timestamp_gte: $timestamp }
    ) {
      id
      oldNormFactor
      newNormFactor
      lastModificationTimestamp
      timestamp
    }
  }
`

export default NORMHISTORY_QUERY

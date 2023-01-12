import { gql } from '@apollo/client'

// Can't skip more than 5000 items. If we wan't to skip more than that we should use lastID.
// Refer https://thegraph.com/docs/en/querying/graphql-api/#pagination
const NORMHISTORY_QUERY = gql`
  query normalizationFactorUpdates($lastID: String) {
    normalizationFactorUpdates(first: 1000, orderBy: timestamp, where: { id_gt: $lastID }) {
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

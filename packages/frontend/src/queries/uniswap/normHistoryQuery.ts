import { gql } from '@apollo/client'

const NORMHISTORY_QUERY = gql`
  query normalizationFactorUpdates($timeAgo: Int) {
    normalizationFactorUpdates(first: 1000, orderBy: timestamp, where: { timestamp_gt: $timeAgo }) {
      id
      oldNormFactor
      newNormFactor
      lastModificationTimestamp
      timestamp
    }
  }
`
export default NORMHISTORY_QUERY

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

export const NORMHISTORY_TIMESTAMP_QUERY = gql`
  query normalizationFactorUpdates($timestamp: Int) {
    factor0: normalizationFactorUpdates(
      first: 1
      orderBy: timestamp
      orderDirection: desc
      where: { timestamp_lte: $timestamp }
    ) {
      id
      oldNormFactor
      newNormFactor
      lastModificationTimestamp
      timestamp
    }
    factor1: normalizationFactorUpdates(
      first: 1
      orderBy: timestamp
      orderDirection: asc
      where: { timestamp_gte: $timestamp }
    ) {
      id
      oldNormFactor
      newNormFactor
      lastModificationTimestamp
      timestamp
    }
  }
`

export const NORMHISTORY_TIME_QUERY = gql`
  query normalizationFactorUpdates($timestamp: Int, $timestampOnedayAfter: Int) {
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

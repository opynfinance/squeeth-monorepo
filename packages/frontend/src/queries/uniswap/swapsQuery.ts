import { gql } from '@apollo/client'

export const SWAPS_SUBSCRIPTION = gql`
  subscription subscriptionSwaps(
    $poolAddress: String!
    $origin: String!
    $recipients: [String!]!
    $orderDirection: String!
  ) {
    swaps(
      where: { pool: $poolAddress, origin: $origin, recipient_in: $recipients }
      orderBy: timestamp
      orderDirection: $orderDirection
    ) {
      id
      recipient
      amount0
      amount1
      timestamp
      origin
      transaction {
        id
        blockNumber
      }
    }
  }
`

export const SWAPS_QUERY = gql`
  query swaps($poolAddress: String!, $origin: String!, $recipients: [String!]!, $orderDirection: String!) {
    swaps(
      where: { pool: $poolAddress, origin: $origin, recipient_in: $recipients }
      orderBy: timestamp
      orderDirection: $orderDirection
    ) {
      id
      recipient
      amount0
      amount1
      timestamp
      origin
      transaction {
        id
        blockNumber
      }
    }
  }
`
export default SWAPS_QUERY

import { gql } from '@apollo/client'

export const SWAPS_SUBSCRIPTION = gql`
  subscription subscriptionSwaps(
    $poolAddress: String!
    $recipients: [String!]!
    $tokenAddress: Bytes!
    $origin: Bytes!
  ) {
    swaps(orderBy: timestamp, orderDirection: asc, where: { token1: $tokenAddress, origin: $origin }) {
      pool {
        token0 {
          id
          symbol
        }
        token1 {
          id
          symbol
        }
      }
      id
      timestamp
      recipient
      amount0
      amount1
      amountUSD
      origin
      transaction {
        id
        blockNumber
      }
    }
  }
`

export const SWAPS_QUERY = gql`
  query swaps($poolAddress: String!, $recipients: [String!]!, $tokenAddress: Bytes!, $origin: Bytes!) {
    swaps(orderBy: timestamp, orderDirection: asc, where: { token1: $tokenAddress, origin: $origin }) {
      pool {
        token0 {
          id
          symbol
        }
        token1 {
          id
          symbol
        }
      }
      id
      timestamp
      recipient
      amount0
      amount1
      amountUSD
      origin
      transaction {
        id
        blockNumber
      }
    }
  }
`
export default SWAPS_QUERY

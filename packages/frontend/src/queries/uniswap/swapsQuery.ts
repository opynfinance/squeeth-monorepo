import { gql } from '@apollo/client'

export const SWAPS_SUBSCRIPTION = gql`
  subscription subscriptionSwaps(
    $tokenAddress: Bytes!
    $origin: Bytes!
    $orderDirection: String!
    $recipient_not_in: [Bytes!]!
  ) {
    swaps(
      orderBy: timestamp
      orderDirection: $orderDirection
      where: { token1: $tokenAddress, origin: $origin, recipient_not_in: $recipient_not_in }
      first: 1000
      skip: 0
    ) {
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
  query swaps($tokenAddress: Bytes!, $origin: Bytes!, $orderDirection: String!, $recipient_not_in: [Bytes!]!) {
    swaps(
      orderBy: timestamp
      orderDirection: $orderDirection
      where: { token1: $tokenAddress, origin: $origin, recipient_not_in: $recipient_not_in, poolAddress: $poolAddress }
      first: 1000
      skip: 0
    ) {
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

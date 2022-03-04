import { gql } from '@apollo/client'

export const SWAPS_SUBSCRIPTION = gql`
  subscription subscriptionSwaps(
    $tokenAddress: Bytes!
    $origin: Bytes!
    $orderDirection: String!
    $recipient_not: Bytes!
  ) {
    swaps(
      orderBy: timestamp
      orderDirection: $orderDirection
      where: { token1: $tokenAddress, origin: $origin, recipient_not: $recipient_not }
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
  query swaps($tokenAddress: Bytes!, $origin: Bytes!, $orderDirection: String!, $recipient_not: Bytes!) {
    swaps(
      orderBy: timestamp
      orderDirection: $orderDirection
      where: { token1: $tokenAddress, origin: $origin, recipient_not: $recipient_not, poolAddress: $poolAddress }
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

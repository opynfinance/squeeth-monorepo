import { gql } from '@apollo/client'

export const SWAPS_ROPSTEN_SUBSCRIPTION = gql`
  subscription subscriptionSwapsRopsten(
    $poolAddress: String!
    $recipients: [String!]!
    $origin: Bytes!
    $orderDirection: String!
    $recipient_not_in: [Bytes!]!
  ) {
    swaps(
      orderBy: timestamp
      orderDirection: $orderDirection
      where: { pool: $poolAddress, origin: $origin, recipient_in: $recipients, recipient_not_in: $recipient_not_in }
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

export const SWAPS_ROPSTEN_QUERY = gql`
  query swapsRopsten(
    $poolAddress: String!
    $recipients: [String!]!
    $origin: Bytes!
    $orderDirection: String!
    $recipient_not_in: [Bytes!]!
  ) {
    swaps(
      orderBy: timestamp
      orderDirection: $orderDirection
      where: { pool: $poolAddress, origin: $origin, recipient_in: $recipients, recipient_not_in: $recipient_not_in }
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
export default SWAPS_ROPSTEN_QUERY

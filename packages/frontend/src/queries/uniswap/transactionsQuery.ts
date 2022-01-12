import { gql } from '@apollo/client'

const TRANSACTIONS_QUERY = gql`
  query transactions(
    $poolAddress: Bytes!
    $owner: String!
    $origin: String!
    $recipients: [String!]!
    $orderDirection: String!
  ) {
    positionSnapshots(
      orderBy: id
      orderDirection: $orderDirection
      where: { pool: $poolAddress, owner: $owner }
      subgraphError: allow
    ) {
      id
      owner
      liquidity
      depositedToken0
      depositedToken1
      withdrawnToken0
      withdrawnToken1
      transaction {
        id
        timestamp
      }
    }
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
export default TRANSACTIONS_QUERY

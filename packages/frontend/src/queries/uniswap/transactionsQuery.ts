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
  }
`
export default TRANSACTIONS_QUERY

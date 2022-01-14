import { gql } from '@apollo/client'

export const USER_CRAB_TX_QUERY = gql`
  query userCrabTxes($ownerId: ID!) {
    crabStrategyTxes(orderBy: timestamp, orderDirection: desc, where: { owner: $ownerId }) {
      id
      type
      ethAmount
      wSqueethAmount
      lpAmount
      timestamp
    }
  }
`
export default USER_CRAB_TX_QUERY

import { gql } from '@apollo/client'

export const CRAB_STRATEGY_TX_QUERY = gql`
  query crabStrategyTxes {
    crabStrategyTxes(orderBy: timestamp, orderDirection: desc) {
      id
      type
      ethAmount
      wSqueethAmount
      lpAmount
      timestamp
    }
  }
`
export default CRAB_STRATEGY_TX_QUERY

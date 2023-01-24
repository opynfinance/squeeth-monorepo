import { gql } from '@apollo/client'

export const STRATEGY_QUERY = gql`
  query strategyQuery($strategyId: ID!) {
    strategy(id: $strategyId) {
      id
      vaultId
      lastHedgeTx
      lastHedgeTimestamp
      lastHedgeBlockNumber
    }
  }
`
export default STRATEGY_QUERY

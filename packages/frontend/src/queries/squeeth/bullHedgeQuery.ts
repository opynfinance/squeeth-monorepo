import { gql } from '@apollo/client'

export const BULL_REBALANCE_QUERY = gql`
  query bullHedges {
    fullRebalances(orderBy: timestamp, orderDirection: desc) {
      id
      wPowerPerpAmount
      isDepositingInCrab
      timestamp
      wethTargetInEuler
    }
    leverageRebalances(orderBy: timestamp, orderDirection: desc) {
      id
      isSellingUsdc
      usdcAmount
      timestamp
    }
  }
`
export default BULL_REBALANCE_QUERY

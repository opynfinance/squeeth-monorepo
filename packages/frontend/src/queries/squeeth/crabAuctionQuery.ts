import { gql } from '@apollo/client'

export const CRAB_TX_QUERY = gql`
  query crabAuctions {
    crabAuctions(orderBy: timestamp, orderDirection: desc) {
      id
      owner
      squeethAmount
      ethAmount
      isSellingSqueeth
      isHedgingOnUniswap
      timestamp
    }
  }
`
export default CRAB_TX_QUERY

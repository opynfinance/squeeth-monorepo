import { gql } from '@apollo/client'

export const CRAB_TX_QUERY = gql`
  query crabAuctions {
    crabAuctions {
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

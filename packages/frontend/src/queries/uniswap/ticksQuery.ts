import { gql } from '@apollo/client'

export const TICKS_QUERY = gql`
  query ticks($poolAddress: String!) {
    ticks(where: { poolAddress: $poolAddress }, first: 1000) {
      id
      tickIdx
      liquidityNet
      liquidityGross
    }
  }
`
export default TICKS_QUERY

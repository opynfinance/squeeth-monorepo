import { gql } from '@apollo/client'

export const TICKS_QUERY = gql`
  query ticks($poolAddress: String!) {
    ticks(where: { poolAddress: $poolAddress }) {
      id
      tickIdx
      liquidityNet
      liquidityGross
    }
  }
`
export default TICKS_QUERY

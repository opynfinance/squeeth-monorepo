import { gql } from '@apollo/client'

export const POOLS_QUERY = gql`
  query pools {
    pools(first: 5) {
      id
      token0Price
      token1Price
    }
  }
`

import { gql } from '@apollo/client'

export const POOLS_QUERY = gql`
  query pools {
    pools(first: 2) {
      id
      token0Price
      token1Price
    }
  }
`

export const POOLS_SUBSCRIPTION = gql`
  subscription subscriptionPools {
    pools(first: 2) {
      id
      token0Price
      token1Price
    }
  }
`

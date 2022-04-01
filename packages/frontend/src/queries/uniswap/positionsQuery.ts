import { gql } from '@apollo/client'

export const POSITIONS_SUBSCRIPTION = gql`
  subscription subscriptionpositions($poolAddress: String!, $owner: String!) {
    positions(where: { pool: $poolAddress, owner: $owner }) {
      id
      owner
      liquidity
      token0 {
        id
        symbol
      }
      token1 {
        id
        symbol
      }
      pool {
        id
      }
      tickLower {
        id
        price0
        price1
        tickIdx
      }
      tickUpper {
        id
        price0
        price1
        tickIdx
      }
      collectedFeesToken0
      collectedFeesToken1
      depositedToken0
      depositedToken1
      withdrawnToken0
      withdrawnToken1
    }
  }
`

export const POSITIONS_QUERY = gql`
  query positions($poolAddress: String!, $owner: String!) {
    positions(where: { pool: $poolAddress, owner: $owner }) {
      id
      owner
      liquidity
      token0 {
        id
        symbol
      }
      token1 {
        id
        symbol
      }
      pool {
        id
      }
      tickLower {
        id
        price0
        price1
        tickIdx
      }
      tickUpper {
        id
        price0
        price1
        tickIdx
      }
      collectedFeesToken0
      collectedFeesToken1
      depositedToken0
      depositedToken1
      withdrawnToken0
      withdrawnToken1
    }
  }
`

export const ACTIVE_POSITIONS_QUERY = gql`
  query activePositions($poolAddress: String!, $owner: String!) {
    positions(where: { pool: $poolAddress, owner: $owner, liquidity_gt: 0 }) {
      id
      owner
      liquidity
      token0 {
        id
        symbol
      }
      token1 {
        id
        symbol
      }
      pool {
        id
      }
      tickLower {
        id
        price0
        price1
        tickIdx
      }
      tickUpper {
        id
        price0
        price1
        tickIdx
      }
      collectedFeesToken0
      collectedFeesToken1
      depositedToken0
      depositedToken1
      withdrawnToken0
      withdrawnToken1
    }
  }
`
export default POSITIONS_QUERY

import { gql } from '@apollo/client'

export const SWAPS_MINTS_TRANSACTIONS = gql`
  query txs($tokenAddress: Bytes!, $origin: String!) {
    swaps: swaps(orderBy: timestamp, orderDirection: asc, where: { token1: $tokenAddress, origin: $origin }) {
      pool {
        token0 {
          id
          symbol
        }
        token1 {
          id
          symbol
        }
      }
      id
      timestamp
      recipient
      amount0
      amount1
      amountUSD
      origin
      transaction {
        id
        blockNumber
      }
    }
  }
`

export const SWAPS_MINTS_SUBSCRIPTION = gql`
  subscription subscriptionTxs($tokenAddress: Bytes!, $origin: String!) {
    swaps: swaps(orderBy: timestamp, orderDirection: asc, where: { token1: $tokenAddress, origin: $origin }) {
      pool {
        token0 {
          id
          symbol
        }
        token1 {
          id
          symbol
        }
      }
      id
      timestamp
      recipient
      amount0
      amount1
      amountUSD
      origin
      transaction {
        id
        blockNumber
      }
    }
  }
`

// mintsAs1: mints(orderBy: timestamp, orderDirection: desc, where: { token1: $tokenAddress, origin: $origin }) {
//     timestamp
//     transaction {
//       id
//     }
//     pool {
//       token0 {
//         id
//         symbol
//       }
//       token1 {
//         id
//         symbol
//       }
//     }
//     owner
//     sender
//     origin
//     amount0
//     amount1
//     amountUSD
//   }
// }

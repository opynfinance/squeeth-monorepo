import { gql } from '@apollo/client'

const ALL_TRANSACTIONS = gql`
  query transactions {
    mintsAs0: mints(
      first: 1000
      orderBy: timestamp
      orderDirection: desc
      where: { token0: "0xf1b99e3e573a1a9c5e6b2ce818b617f0e664e86b" }
      subgraphError: allow
    ) {
      timestamp
      transaction {
        id
      }
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
      owner
      sender
      origin
      amount0
      amount1
      amountUSD
    }
    mintsAs1: mints(
      first: 1000
      orderBy: timestamp
      orderDirection: desc
      where: { token0: "0xf1b99e3e573a1a9c5e6b2ce818b617f0e664e86b" }
      subgraphError: allow
    ) {
      timestamp
      transaction {
        id
      }
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
      owner
      sender
      origin
      amount0
      amount1
      amountUSD
    }
    swapsAs0: swaps(
      first: 1000
      orderBy: timestamp
      orderDirection: desc
      where: { token0: "0xf1b99e3e573a1a9c5e6b2ce818b617f0e664e86b" }
      subgraphError: allow
    ) {
      timestamp
      transaction {
        id
      }
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
      origin
      amount0
      amount1
      amountUSD
    }
    swapsAs1: swaps(
      first: 1000
      orderBy: timestamp
      orderDirection: desc
      where: { token1: "0xf1b99e3e573a1a9c5e6b2ce818b617f0e664e86b" }
      subgraphError: allow
    ) {
      timestamp
      transaction {
        id
      }
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
      origin
      amount0
      amount1
      amountUSD
    }
    burnsAs0: burns(
      first: 1000
      orderBy: timestamp
      orderDirection: desc
      where: { token0: "0xf1b99e3e573a1a9c5e6b2ce818b617f0e664e86b" }
      subgraphError: allow
    ) {
      timestamp
      transaction {
        id
      }
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
      owner
      amount0
      amount1
      amountUSD
    }
    burnsAs1: burns(
      first: 1000
      orderBy: timestamp
      orderDirection: desc
      where: { token1: "0xf1b99e3e573a1a9c5e6b2ce818b617f0e664e86b" }
      subgraphError: allow
    ) {
      timestamp
      transaction {
        id
      }
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
      owner
      amount0
      amount1
      amountUSD
    }
  }
`

export default ALL_TRANSACTIONS

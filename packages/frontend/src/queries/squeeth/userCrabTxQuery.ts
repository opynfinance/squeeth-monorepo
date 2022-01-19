import { gql } from '@apollo/client'

export const USER_CRAB_TX_QUERY = gql`
  query userCrabTxes($ownerId: ID!, $orderDirection: String!) {
    crabStrategyTxes(
      orderBy: timestamp
      orderDirection: $orderDirection
      where: { owner: $ownerId, type_in: ["FLASH_DEPOSIT", "FLASH_WITHDRAW"] }
    ) {
      id
      type
      ethAmount
      wSqueethAmount
      lpAmount
      timestamp
    }
  }
`
export default USER_CRAB_TX_QUERY

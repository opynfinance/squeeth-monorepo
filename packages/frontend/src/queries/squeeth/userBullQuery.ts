import { gql } from '@apollo/client'

export const USER_BULL_TX_QUERY = gql`
  query userBullTxes($ownerId: ID!, $orderDirection: String!) {
    bullUserTxes(
      orderBy: timestamp
      orderDirection: $orderDirection
      where: { owner: $ownerId, type_in: ["FLASH_DEPOSIT", "FLASH_WITHDRAW"] }
    ) {
      id
      owner
      bullAmount
      ethAmount
      type
      timestamp
    }
  }
`
export default USER_BULL_TX_QUERY

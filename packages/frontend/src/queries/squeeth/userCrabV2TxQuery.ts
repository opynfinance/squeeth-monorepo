import { gql } from '@apollo/client'

export const USER_CRAB_V2_TX_QUERY = gql`
  query userCrabV2Txes($ownerId: ID!, $orderDirection: String!) {
    crabUserTxes(
      orderBy: timestamp
      orderDirection: $orderDirection
      where: {
        owner: $ownerId
        type_in: ["FLASH_DEPOSIT", "FLASH_WITHDRAW", "DEPOSIT", "WITHDRAW", "DEPOSIT_V1", "DEPOSIT_OTC", "WITHDRAW_OTC"]
      }
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
export default USER_CRAB_V2_TX_QUERY

import { gql } from '@apollo/client'

export const USER_CRAB_V2_TX_QUERY = gql`
  query userCrabV2Txes($ownerId: ID!, $orderDirection: String!) {
    crabUserTxes(
      orderBy: timestamp
      orderDirection: $orderDirection
      where: { owner: $ownerId, type_in: ["FLASH_DEPOSIT", "FLASH_WITHDRAW", "DEPOSIT", "WITHDRAW", "DEPOSIT_V1"] }
    ) {
      id
      type
      ethAmount
      wSqueethAmount
      lpAmount
      timestamp
      excessEth
      erc20Token
      erc20Amount
    }
  }
`
export default USER_CRAB_V2_TX_QUERY

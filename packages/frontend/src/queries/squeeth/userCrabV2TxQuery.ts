import { gql } from '@apollo/client'

export const USER_CRAB_V2_TX_QUERY = gql`
  query userCrabV2Txes($ownerId: ID!, $orderDirection: String!) {
    crabUserTxes(
      orderBy: timestamp
      orderDirection: $orderDirection
      where: {
        owner: $ownerId
        type_in: ["FLASH_DEPOSIT", "FLASH_WITHDRAW", "DEPOSIT", "WITHDRAW", "DEPOSIT_V1", "OTC_DEPOSIT", "OTC_WITHDRAW"]
      }
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
      transaction
    }
  }
`
export default USER_CRAB_V2_TX_QUERY

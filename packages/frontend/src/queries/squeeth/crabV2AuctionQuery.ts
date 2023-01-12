import { gql } from '@apollo/client'

export const CRAB_V2_AUCTION_QUERY = gql`
  query crabV2Auctions {
    hedgeOTCs(orderBy: timestamp, orderDirection: desc) {
      id
      bidID
      quantity
      isBuying
      clearingPrice
      timestamp
    }
  }
`
export default CRAB_V2_AUCTION_QUERY
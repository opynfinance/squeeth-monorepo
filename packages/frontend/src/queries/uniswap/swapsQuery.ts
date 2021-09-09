import { gql } from '@apollo/client'

export const SWAPS_QUERY = gql`
  query swaps($poolAddress: String!, $origin: String!, $recipients: [String!]!) {
    swaps(where: { pool: $poolAddress, origin: $origin, recipient_in: $recipients }, orderBy: timestamp) {
      id
      recipient
      amount0
      amount1
      timestamp
      origin
    }
  }
`
export default SWAPS_QUERY

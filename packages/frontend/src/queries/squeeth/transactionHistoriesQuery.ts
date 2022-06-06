import { gql } from '@apollo/client'

export const TRANSACTION_HISTORIES_QUERY = gql`
  query TransactionHistories($ownerId: ID!) {
    transactionHistories(where: { owner: $ownerId }) {
      id
      transactionType
      timestamp
      ethAmount
      oSqthAmount
      oSqthPrice
    }
  }
`

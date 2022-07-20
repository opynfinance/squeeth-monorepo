import { gql } from '@apollo/client'

export const ACCOUNT_QUERY = gql`
  query account($id: ID!) {
    account(id: $id) {
      sqthOpenAmount
      sqthOpenUnitPrice
      sqthCloseAmount
      sqthCloseUnitPrice
      ethDepositAmount
      ethDepositUnitPrice
      ethWithdrawAmount
      ethWithdrawUnitPrice
    }
  }
`

export const ACCOUNT_SUBSCRIPTION = gql`
  subscription accountSubscription($id: ID!) {
    account(id: $id) {
      sqthOpenAmount
      sqthOpenUnitPrice
      sqthCloseAmount
      sqthCloseUnitPrice
      ethDepositAmount
      ethDepositUnitPrice
      ethWithdrawAmount
      ethWithdrawUnitPrice
    }
  }
`

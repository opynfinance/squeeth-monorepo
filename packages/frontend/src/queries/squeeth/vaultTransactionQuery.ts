import { gql } from '@apollo/client'

const VAULT_TRANSACTIONS_QUERY = gql`
  query VaultTransactions($vaultId: ID!) {
    vaultTransactions(where: { vaultId: $vaultId }) {
      id
      amount
      type
      timestamp
      totalCollateralAmount
    }
  }
`

export default VAULT_TRANSACTIONS_QUERY

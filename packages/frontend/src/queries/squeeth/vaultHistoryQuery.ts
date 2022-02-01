import { gql } from '@apollo/client'

const VAULT_HISTORY_QUERY = gql`
  query VaultHistory($vaultId: ID!) {
    vaultHistories(where: { vaultId: $vaultId }) {
      id
      timestamp
      totalEthCollateralAmount
      oSqthAmount
      ethCollateralAmount
      action
      vaultId
    }
  }
`

export default VAULT_HISTORY_QUERY

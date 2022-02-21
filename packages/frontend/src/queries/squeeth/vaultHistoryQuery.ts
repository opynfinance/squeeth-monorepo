import { gql } from '@apollo/client'

const VAULT_HISTORY_QUERY = gql`
  query VaultHistory($vaultId: BigInt!) {
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

export const VAULT_HISTORY_SUBSCRIPTION = gql`
  subscription subscriptionVaultHistory($vaultId: BigInt!) {
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

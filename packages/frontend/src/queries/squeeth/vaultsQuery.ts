import { gql } from '@apollo/client'

export const VAULTS_QUERY = gql`
  query Vaults($ownerId: ID!) {
    vaults(where: { owner: $ownerId }) {
      id
      shortAmount
      collateralAmount
      NftCollateralId
      owner {
        id
      }
      operator
    }
  }
`

export const YOUR_VAULTS_QUERY = gql`
  query YourVaults($ownerId: ID!) {
    vaults(where: { owner: $ownerId, collateralAmount_gt: 0 }) {
      id
      shortAmount
      collateralAmount
    }
  }
`

export const VAULTS_SUBSCRIPTION = gql`
  subscription subscriptionVaults($ownerId: ID!) {
    vaults(where: { owner: $ownerId }) {
      id
      shortAmount
      collateralAmount
      NftCollateralId
      owner {
        id
      }
      operator
    }
  }
`

export const VAULT_QUERY = gql`
  query Vault($vaultID: ID!) {
    vault(id: $vaultID) {
      id
      shortAmount
      collateralAmount
      NftCollateralId
      owner {
        id
      }
      operator
    }
  }
`

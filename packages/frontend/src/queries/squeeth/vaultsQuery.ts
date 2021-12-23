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
export default VAULTS_QUERY

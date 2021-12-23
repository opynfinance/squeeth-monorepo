import { gql } from '@apollo/client'

export const LIQUIDATIONS_QUERY = gql`
  query liquidations($vaultId: BigInt!) {
    liquidations(where: { vaultId: $vaultId }) {
      id
      debtAmount
      liquidator
      vaultId
      collateralPaid
    }
  }
`
export default LIQUIDATIONS_QUERY

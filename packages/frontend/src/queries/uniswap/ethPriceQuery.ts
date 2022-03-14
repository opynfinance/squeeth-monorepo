import { gql } from '@apollo/client'

export const ETHPRICE_QUERY = gql`
  query bundles($blockNo: Int) {
    bundles(where: { id: 1 }, block: { number: $blockNo }) {
      id
      ethPriceUSD
    }
  }
`

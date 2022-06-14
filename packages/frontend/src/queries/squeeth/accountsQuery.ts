import { gql } from '@apollo/client'

export const ACCOUNTS_QUERY = gql`
  query accounts($ownerId: ID!) {
    accounts(where: { id: $ownerId }) {
      id
      positions {
        id
        positionType
        currentOSQTHAmount
        currentETHAmount
        unrealizedOSQTHUnitCost
        unrealizedETHUnitCost
        realizedOSQTHUnitCost
        realizedETHUnitCost
        realizedOSQTHUnitGain
        realizedETHUnitGain
        realizedOSQTHAmount
        realizedETHAmount
      }
      lppositions {
        id
        currentOSQTHAmount
        currentETHAmount
        unrealizedOSQTHUnitCost
        unrealizedETHUnitCost
        realizedOSQTHUnitCost
        realizedETHUnitCost
        realizedOSQTHUnitGain
        realizedETHUnitGain
        realizedOSQTHAmount
        realizedETHAmount
      }
    }
  }
`

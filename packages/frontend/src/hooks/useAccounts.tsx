import { useQuery } from '@apollo/client'
import { ACCOUNTS_QUERY } from '@queries/squeeth/accountsQuery'
import {
  accounts,
  accountsVariables,
  accounts_accounts_positions,
  accounts_accounts_lppositions,
} from '@queries/squeeth/__generated__/accounts'
import { squeethClient } from '@utils/apollo-client'
import BigNumber from 'bignumber.js'
import { useAtom, useAtomValue } from 'jotai'
import { positionTypeAtom } from 'src/state/positions/atoms'
import { addressAtom, networkIdAtom } from 'src/state/wallet/atoms'
import { PositionType } from 'src/types'
import useAppEffect from './useAppEffect'

const initPosition = {
  currentOSQTHAmount: new BigNumber(0),
  currentETHAmount: new BigNumber(0),
  unrealizedOSQTHUnitCost: new BigNumber(0),
  unrealizedETHUnitCost: new BigNumber(0),
  realizedOSQTHUnitCost: new BigNumber(0),
  realizedETHUnitCost: new BigNumber(0),
  realizedOSQTHUnitGain: new BigNumber(0),
  realizedETHUnitGain: new BigNumber(0),
  realizedOSQTHAmount: new BigNumber(0),
  realizedETHAmount: new BigNumber(0),
}

export default function useAccounts() {
  const address = useAtomValue(addressAtom)
  const networkId = useAtomValue(networkIdAtom)
  const [positionType, setPositionType] = useAtom(positionTypeAtom)

  const { data: { accounts } = {}, loading } = useQuery<accounts, accountsVariables>(ACCOUNTS_QUERY, {
    variables: { ownerId: address! },
    client: squeethClient[networkId],
    skip: !address,
  })

  useAppEffect(() => {
    setPositionType(accounts ? accounts[0]?.positions[0].positionType : PositionType.NONE)
  }, [accounts, setPositionType])

  return {
    positions: (accounts ? accounts[0]?.positions[0] : initPosition) as accounts_accounts_positions,
    lpPosition: (accounts ? accounts[0]?.lppositions[0] : initPosition) as accounts_accounts_lppositions,
    positionType: positionType,
    loading,
  }
}

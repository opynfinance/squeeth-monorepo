import { useState } from 'react'
import { useQuery, NetworkStatus } from '@apollo/client'
import { BIG_ZERO } from '@constants/index'

import VAULT_HISTORY_QUERY, { VAULT_HISTORY_SUBSCRIPTION } from '../queries/squeeth/vaultHistoryQuery'
import {
  VaultHistory,
  VaultHistoryVariables,
  VaultHistory_vaultHistories,
} from '../queries/squeeth/__generated__/VaultHistory'
import { squeethClient } from '@utils/apollo-client'
import { Action } from '@constants/index'
import { toTokenAmount } from '@utils/calculations'
import { addressAtom, networkIdAtom } from 'src/state/wallet/atoms'
import { useAtomValue } from 'jotai'
import { usePrevious } from 'react-use'
import { vaultHistoryUpdatingAtom } from 'src/state/positions/atoms'
import { useUpdateAtom } from 'jotai/utils'
import useAppEffect from './useAppEffect'
import useAppMemo from './useAppMemo'

export const useVaultHistoryQuery = (vaultId: number, poll = false) => {
  const address = useAtomValue(addressAtom)
  const networkId = useAtomValue(networkIdAtom)
  const [vaultHistories, setVaultHistories] = useState<VaultHistory_vaultHistories[]>([])
  const setVaultHistoryUpdating = useUpdateAtom(vaultHistoryUpdatingAtom)

  const { data, loading, refetch, subscribeToMore, startPolling, stopPolling, networkStatus } = useQuery<
    VaultHistory,
    VaultHistoryVariables
  >(VAULT_HISTORY_QUERY, {
    client: squeethClient[networkId],
    fetchPolicy: 'cache-and-network',
    notifyOnNetworkStatusChange: true,
    variables: {
      vaultId: vaultId,
    },
  })
  const vaultHistory = data?.vaultHistories
  const prevVaultHistory = usePrevious(vaultHistory)

  useAppEffect(() => {
    if (vaultHistory && vaultHistory.length > 0) {
      setVaultHistories(vaultHistory)
    }
  }, [vaultHistory])

  useAppEffect(() => {
    if (poll && prevVaultHistory?.length === vaultHistory?.length) {
      startPolling(500)
    } else {
      setVaultHistoryUpdating(false)
      stopPolling()
    }
  }, [poll, prevVaultHistory, startPolling, stopPolling, vaultHistory, setVaultHistoryUpdating])

  useAppEffect(() => {
    subscribeToMore({
      document: VAULT_HISTORY_SUBSCRIPTION,
      variables: {
        vaultId: vaultId,
      },
      updateQuery(prev, { subscriptionData }) {
        if (!subscriptionData.data || subscriptionData.data.vaultHistories.length === data?.vaultHistories.length)
          return prev
        const newVaultsHistories = subscriptionData.data.vaultHistories
        return { vaultHistories: newVaultsHistories }
      },
    })
  }, [address, vaultId, subscribeToMore, data?.vaultHistories.length])

  return {
    vaultHistory: vaultHistories,
    loading: loading || poll || networkStatus === NetworkStatus.refetch,
    refetch,
  }
}

export const useVaultHistory = (vaultId: number) => {
  const { vaultHistory } = useVaultHistoryQuery(vaultId)

  //accumulated four actions, mintedSqueeth doesn't take minted squeeth sold into account
  //only consider first valid vault
  //mintedSqueeth + openShortSqueeth = shortAmount in the vault
  const { mintedSqueeth, burnedSqueeth, openShortSqueeth, closeShortSqueeth } = useAppMemo(
    () =>
      vaultHistory?.reduce(
        (acc, s) => {
          if (s.action === Action.MINT) {
            acc.mintedSqueeth = acc.mintedSqueeth.plus(s.oSqthAmount)
          } else if (s.action === Action.BURN) {
            acc.mintedSqueeth = acc.mintedSqueeth.minus(s.oSqthAmount)
            acc.burnedSqueeth = acc.burnedSqueeth.plus(s.oSqthAmount)
          } else if (s.action === Action.OPEN_SHORT) {
            acc.openShortSqueeth = acc.openShortSqueeth.plus(s.oSqthAmount)
          } else if (s.action === Action.CLOSE_SHORT) {
            acc.closeShortSqueeth = acc.closeShortSqueeth.plus(s.oSqthAmount)
            // users fully close short position
            if (
              acc.closeShortSqueeth.isEqualTo(acc.openShortSqueeth.plus(acc.mintedSqueeth)) &&
              !acc.closeShortSqueeth.isEqualTo(0)
            ) {
              acc.mintedSqueeth = BIG_ZERO
              acc.burnedSqueeth = BIG_ZERO
              acc.openShortSqueeth = BIG_ZERO
              acc.closeShortSqueeth = BIG_ZERO
            } else {
              acc.openShortSqueeth = acc.openShortSqueeth.minus(s.oSqthAmount)
            }
          }
          //if user burn all their osqueeth, reset all values
          if (acc.mintedSqueeth.isLessThanOrEqualTo(0)) {
            acc.mintedSqueeth = BIG_ZERO
            acc.burnedSqueeth = BIG_ZERO
          }
          //if user close all their short position with OPEN_SHORT/CLOSE_SHORT, reset all values
          if (acc.openShortSqueeth.isLessThanOrEqualTo(0)) {
            acc.openShortSqueeth = BIG_ZERO
            acc.closeShortSqueeth = BIG_ZERO
          }

          return acc
        },
        {
          mintedSqueeth: BIG_ZERO,
          burnedSqueeth: BIG_ZERO,
          openShortSqueeth: BIG_ZERO,
          closeShortSqueeth: BIG_ZERO,
        },
      ) || {
        mintedSqueeth: BIG_ZERO,
        burnedSqueeth: BIG_ZERO,
        openShortSqueeth: BIG_ZERO,
        closeShortSqueeth: BIG_ZERO,
      },
    [vaultHistory],
  )
  // console.log(vaultHistory, toTokenAmount(mintedSqueeth, 18).toString(), toTokenAmount(openShortSqueeth, 18).toString())
  return {
    mintedSqueeth: toTokenAmount(mintedSqueeth, 18),
    burnedSqueeth: toTokenAmount(burnedSqueeth, 18),
    openShortSqueeth: toTokenAmount(openShortSqueeth, 18),
    closeShortSqueeth: toTokenAmount(closeShortSqueeth, 18),
    vaultHistory,
  }
}

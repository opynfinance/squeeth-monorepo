import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@apollo/client'

import { useWallet } from '@context/wallet'
import { BIG_ZERO } from '@constants/index'

import VAULT_HISTORY_QUERY, { VAULT_HISTORY_SUBSCRIPTION } from '../queries/squeeth/vaultHistoryQuery'
import { VaultHistory, VaultHistoryVariables } from '../queries/squeeth/__generated__/VaultHistory'
import { squeethClient } from '@utils/apollo-client'
import { Action } from '@constants/index'
import { toTokenAmount } from '@utils/calculations'
import { useVaultManager } from '@hooks/contracts/useVaultManager'

export const useVaultHistory = () => {
  const { address, networkId } = useWallet()
  const { vaults, firstValidVault } = useVaultManager()

  const vaultId = vaults[firstValidVault]?.id ?? 0
  const { data, subscribeToMore } = useQuery<VaultHistory, VaultHistoryVariables>(VAULT_HISTORY_QUERY, {
    client: squeethClient[networkId],
    fetchPolicy: 'cache-and-network',
    variables: {
      vaultId: vaultId,
    },
  })
  const vaultHistory = data?.vaultHistories
  useEffect(() => {
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
  }, [address, vaultId, subscribeToMore])

  //accumulated four actions, mintedSqueeth doesn't take minted squeeth sold into account
  //only consider first valid vault
  const { mintedSqueeth, burnedSqueeth, openShortSqueeth, closeShortSqueeth } = useMemo(
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
            acc.openShortSqueeth = acc.openShortSqueeth.minus(s.oSqthAmount)
            acc.closeShortSqueeth = acc.closeShortSqueeth.plus(s.oSqthAmount)
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
    [vaultHistory?.length],
  )
  console.log(vaultHistory, toTokenAmount(mintedSqueeth, 18).toString(), toTokenAmount(openShortSqueeth, 18).toString())
  return {
    mintedSqueeth: toTokenAmount(mintedSqueeth, 18),
    burnedSqueeth: toTokenAmount(burnedSqueeth, 18),
    openShortSqueeth: toTokenAmount(openShortSqueeth, 18),
    closeShortSqueeth: toTokenAmount(closeShortSqueeth, 18),
    vaultHistory,
  }
}

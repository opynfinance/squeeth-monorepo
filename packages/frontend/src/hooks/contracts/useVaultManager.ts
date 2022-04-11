import { useQuery } from '@apollo/client'
import BigNumber from 'bignumber.js'
import { useEffect, useState } from 'react'
import { usePrevious } from 'react-use'

import { toTokenAmount } from '@utils/calculations'
import { OSQUEETH_DECIMALS } from '../../constants/'
import { VAULTS_QUERY, VAULTS_SUBSCRIPTION } from '../../queries/squeeth/vaultsQuery'
import { Vaults } from '../../queries/squeeth/__generated__/Vaults'
import { squeethClient } from '../../utils/apollo-client'
import { useAtomValue } from 'jotai'
import { addressAtom, networkIdAtom } from 'src/state/wallet/atoms'
import { useUpdateAtom } from 'jotai/utils'
import { vaultHistoryUpdatingAtom } from 'src/state/positions/atoms'

/**
 * get user vaults.
 * @param token token address
 * @param refetchIntervalSec refetch interval in seconds
 * @returns {Vault[]}
 */
export const useVaultManager = (poll = false) => {
  const [vaults, setVaults] = useState<Array<any>>([])
  const address = useAtomValue(addressAtom)
  const networkId = useAtomValue(networkIdAtom)
  const setVaultHistoryUpdating = useUpdateAtom(vaultHistoryUpdatingAtom)

  const { data, loading, subscribeToMore, startPolling, stopPolling, refetch } = useQuery<Vaults>(VAULTS_QUERY, {
    client: squeethClient[networkId],
    fetchPolicy: 'cache-and-network',
    variables: {
      ownerId: address ?? '',
    },
  })

  const _vaults = data?.vaults
  const prevVaults = usePrevious(_vaults)

  useEffect(() => {
    if (poll && prevVaults?.length === _vaults?.length) {
      startPolling(500)
    } else {
      setVaultHistoryUpdating(false)
      stopPolling()
    }
  }, [poll, prevVaults?.length, startPolling, stopPolling, _vaults?.length])
  useEffect(() => {
    subscribeToMore({
      document: VAULTS_SUBSCRIPTION,
      variables: {
        ownerId: address ?? '',
      },
      updateQuery(prev, { subscriptionData }) {
        if (!subscriptionData.data || subscriptionData.data.vaults.length === data?.vaults.length) return prev
        const newVaults = subscriptionData.data.vaults
        return { vaults: newVaults }
      },
    })
  }, [address, subscribeToMore])

  useEffect(() => {
    ;(async () => {
      if (!data?.vaults?.length) return

      const _vaults = data?.vaults
        .filter((v) => {
          return new BigNumber(v?.collateralAmount ?? 0).gt(0)
        })
        .map(({ id, NftCollateralId, collateralAmount, shortAmount, operator }) => ({
          id,
          NFTCollateralId: NftCollateralId,
          collateralAmount: toTokenAmount(new BigNumber(collateralAmount), 18),
          shortAmount: toTokenAmount(new BigNumber(shortAmount), OSQUEETH_DECIMALS),
          operator,
        }))

      setVaults(_vaults)
    })()
  }, [data?.vaults?.length])

  return { vaults, loading, refetch }
}

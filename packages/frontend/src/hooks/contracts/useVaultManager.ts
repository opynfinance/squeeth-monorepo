import { useCallback, useState } from 'react'
import { useQuery } from '@apollo/client'
import BigNumber from 'bignumber.js'
import { usePrevious } from 'react-use'
import { useAtomValue } from 'jotai'

import { toTokenAmount } from '@utils/calculations'
import { OSQUEETH_DECIMALS } from '../../constants/'
import { VAULTS_QUERY, VAULTS_SUBSCRIPTION } from '../../queries/squeeth/vaultsQuery'
import { Vaults } from '../../queries/squeeth/__generated__/Vaults'
import { squeethClient } from '../../utils/apollo-client'
import { addressAtom, networkIdAtom } from 'src/state/wallet/atoms'
import useAppEffect from '@hooks/useAppEffect'
import useAppMemo from '@hooks/useAppMemo'

/**
 * get user vaults.
 * @param token token address
 * @param refetchIntervalSec refetch interval in seconds
 * @returns {Vault[]}
 */
export const useVaultManager = () => {
  const address = useAtomValue(addressAtom)
  const networkId = useAtomValue(networkIdAtom)
  const [poll, setPoll] = useState(false)

  const { data, loading, subscribeToMore, startPolling, stopPolling } = useQuery<Vaults>(VAULTS_QUERY, {
    client: squeethClient[networkId],
    fetchPolicy: 'cache-and-network',
    variables: {
      ownerId: address ?? '',
    },
  })

  const beginVaultUpdate = useCallback(() => setPoll(true), [])

  const currentVault = data?.vaults.find((vault) => new BigNumber(vault.collateralAmount).isGreaterThan(0))
  const prevVault = usePrevious(currentVault)

  useAppEffect(() => {
    if (poll && !prevVault && !currentVault) {
      startPolling(500)
    } else if (
      poll &&
      (new BigNumber(prevVault?.shortAmount).isEqualTo(new BigNumber(currentVault?.shortAmount)) ||
        new BigNumber(prevVault?.collateralAmount).isEqualTo(new BigNumber(currentVault?.collateralAmount)))
    ) {
      startPolling(500)
    } else {
      stopPolling()
      setPoll(false)
    }
  }, [
    currentVault?.shortAmount.toString(),
    currentVault?.collateralAmount.toString(),
    poll,
    prevVault?.shortAmount.toString(),
    prevVault?.collateralAmount.toString(),
    startPolling,
    stopPolling,
  ])

  useAppEffect(() => {
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
  }, [address, subscribeToMore, data?.vaults.length])

  const vaultsData = data?.vaults
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

  return useAppMemo(
    () => ({ vaults: vaultsData, loading, beginVaultUpdate }),
    [beginVaultUpdate, loading, data?.vaults],
  )
}

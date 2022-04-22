import { useQuery } from '@apollo/client'
import BigNumber from 'bignumber.js'
import { useEffect, useState } from 'react'
import { usePrevious } from 'react-use'
import { useAtomValue } from 'jotai'
import { useUpdateAtom } from 'jotai/utils'

import { toTokenAmount } from '@utils/calculations'
import { OSQUEETH_DECIMALS } from '../../constants/'
import { VAULTS_QUERY, VAULTS_SUBSCRIPTION } from '../../queries/squeeth/vaultsQuery'
import { Vaults } from '../../queries/squeeth/__generated__/Vaults'
import { squeethClient } from '../../utils/apollo-client'
import { addressAtom, networkIdAtom } from 'src/state/wallet/atoms'
import { vaultManagerPollingAtom } from 'src/state/positions/atoms'

/**
 * get user vaults.
 * @param token token address
 * @param refetchIntervalSec refetch interval in seconds
 * @returns {Vault[]}
 */
export const useVaultManager = (poll = false) => {
  const address = useAtomValue(addressAtom)
  const networkId = useAtomValue(networkIdAtom)
  const setVaultManagerPolling = useUpdateAtom(vaultManagerPollingAtom)

  const { data, loading, startPolling, stopPolling } = useQuery<Vaults>(VAULTS_QUERY, {
    client: squeethClient[networkId],
    fetchPolicy: 'cache-and-network',
    variables: {
      ownerId: address ?? '',
    },
  })

  const currentVault = data?.vaults.find((vault) => new BigNumber(vault.collateralAmount).isGreaterThan(0))
  const prevVault = usePrevious(currentVault)

  useEffect(() => {
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
      setVaultManagerPolling(false)
    }
  }, [
    currentVault?.shortAmount.toString(),
    currentVault?.collateralAmount.toString(),
    poll,
    prevVault?.shortAmount.toString(),
    prevVault?.collateralAmount.toString(),
    startPolling,
    stopPolling,
    currentVault?.NftCollateralId,
  ])

  const vaults = data?.vaults
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

  return { vaults, loading }
}

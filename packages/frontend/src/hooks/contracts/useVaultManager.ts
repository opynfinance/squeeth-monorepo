import { useQuery } from '@apollo/client'
import BigNumber from 'bignumber.js'
import { useEffect, useState } from 'react'

import { toTokenAmount } from '@utils/calculations'
import { OSQUEETH_DECIMALS } from '../../constants/'
import { VAULTS_QUERY, VAULTS_SUBSCRIPTION } from '../../queries/squeeth/vaultsQuery'
import { Vaults } from '../../queries/squeeth/__generated__/Vaults'
import { squeethClient } from '../../utils/apollo-client'
import { useAtomValue } from 'jotai'
import { addressAtom, networkIdAtom } from 'src/state/wallet/atoms'
import { useUpdateAtom } from 'jotai/utils'
import { firstValidVaultAtom } from 'src/state/positions/atoms'

/**
 * get user vaults.
 * @param token token address
 * @param refetchIntervalSec refetch interval in seconds
 * @returns {Vault[]}
 */
export const useVaultManager = () => {
  const [vaults, setVaults] = useState<Array<any>>([])
  const address = useAtomValue(addressAtom)
  const networkId = useAtomValue(networkIdAtom)
  const setFirstValidVault = useUpdateAtom(firstValidVaultAtom)

  const { data, loading, subscribeToMore } = useQuery<Vaults>(VAULTS_QUERY, {
    client: squeethClient[networkId],
    fetchPolicy: 'cache-and-network',
    variables: {
      ownerId: address,
    },
  })
  useEffect(() => {
    subscribeToMore({
      document: VAULTS_SUBSCRIPTION,
      variables: {
        ownerId: address,
      },
      updateQuery(prev, { subscriptionData }) {
        if (!subscriptionData.data) return prev
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

  useEffect(() => {
    for (let i = 0; i < vaults.length; i++) {
      if (vaults[i]?.collateralAmount.isGreaterThan(0)) {
        setFirstValidVault(i)
      }
    }
  }, [vaults.length])

  return { vaults, loading }
}

import { useQuery } from '@apollo/client'
import BigNumber from 'bignumber.js'
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

  const { data, loading, subscribeToMore } = useQuery<Vaults>(VAULTS_QUERY, {
    client: squeethClient[networkId],
    fetchPolicy: 'cache-and-network',
    variables: {
      ownerId: address ?? '',
    },
  })

  useAppEffect(() => {
    subscribeToMore({
      document: VAULTS_SUBSCRIPTION,
      variables: {
        ownerId: address ?? '',
      },
      updateQuery(prev, { subscriptionData }) {
        if (!subscriptionData.data) return prev
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

  return useAppMemo(() => ({ vaults: vaultsData, loading }), [vaultsData, loading])
}

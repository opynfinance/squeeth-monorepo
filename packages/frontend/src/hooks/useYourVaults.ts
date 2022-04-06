import { QueryHookOptions, useQuery } from '@apollo/client'
import { useAtomValue } from 'jotai'
import { addressAtom, networkIdAtom } from 'src/state/wallet/atoms'
import { YOUR_VAULTS_QUERY } from '../queries/squeeth/vaultsQuery'
import { YourVaults, YourVaultsVariables } from '../queries/squeeth/__generated__/YourVaults'
import { squeethClient } from '../utils/apollo-client'

export default function useYourVaults(options?: QueryHookOptions<YourVaults, YourVaultsVariables>) {
  const address = useAtomValue(addressAtom)
  const networkId = useAtomValue(networkIdAtom)

  return useQuery<YourVaults, YourVaultsVariables>(YOUR_VAULTS_QUERY, {
    client: squeethClient[networkId],
    variables: { ownerId: address?.toLowerCase() ?? '' },
    skip: !address,
    ...options,
  })
}

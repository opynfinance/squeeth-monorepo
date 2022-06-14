import { useQuery } from '@apollo/client'
import { POOLS_QUERY } from '@queries/squeeth/poolsQuery'
import { pools } from '@queries/squeeth/__generated__/pools'
import { squeethClient } from '@utils/apollo-client'
import { BigNumber } from 'bignumber.js'
import { useAtomValue } from 'jotai'
import { addressAtom, networkIdAtom } from 'src/state/wallet/atoms'

export default function useCurrentPrices() {
  const address = useAtomValue(addressAtom)
  const networkId = useAtomValue(networkIdAtom)

  const { data: { pools } = {}, loading } = useQuery<pools>(POOLS_QUERY, {
    client: squeethClient[networkId],
    skip: !address,
  })

  const ethPrice = pools ? new BigNumber(pools[0]?.token0Price) : new BigNumber(0)
  return {
    ethPrice: ethPrice,
    oSqthPrice: pools ? new BigNumber(pools[1]?.token1Price).times(ethPrice) : new BigNumber(0),
    loading,
  }
}

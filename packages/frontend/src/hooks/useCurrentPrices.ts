import { useQuery } from '@apollo/client'
import { POOLS_QUERY, POOLS_SUBSCRIPTION } from '@queries/squeeth/poolsQuery'
import { pools } from '@queries/squeeth/__generated__/pools'
import { squeethClient } from '@utils/apollo-client'
import { BigNumber } from 'bignumber.js'
import { useAtom, useAtomValue } from 'jotai'
import { ethPoolPriceAtom, osqthPoolPriceAtom } from 'src/state/squeethPool/atoms'
import { addressAtom, networkIdAtom } from 'src/state/wallet/atoms'
import useAppEffect from './useAppEffect'

export default function useCurrentPrices() {
  const address = useAtomValue(addressAtom)
  const networkId = useAtomValue(networkIdAtom)
  const [ethPoolPrice, setETHPoolPrice] = useAtom(ethPoolPriceAtom)
  const [osqthPoolPrice, setOSQTHPoolPrice] = useAtom(osqthPoolPriceAtom)

  const {
    data: { pools } = {},
    loading,
    subscribeToMore,
  } = useQuery<pools>(POOLS_QUERY, {
    client: squeethClient[networkId],
    skip: !address,
  })

  useAppEffect(() => {
    subscribeToMore({
      document: POOLS_SUBSCRIPTION,
      variables: {
        client: squeethClient[networkId],
        skip: !address,
      },
      updateQuery(prev, { subscriptionData }) {
        if (!subscriptionData.data) return prev
        const newPools = subscriptionData.data.pools
        return {
          pools: newPools,
        }
      },
    })
  }, [address, networkId, subscribeToMore])

  useAppEffect(() => {
    if (pools) {
      setETHPoolPrice(new BigNumber(pools[0]?.token0Price))
      setOSQTHPoolPrice(new BigNumber(pools[1]?.token1Price.times(pools[0]?.token0Price)))
    }
  }, [pools, setETHPoolPrice, setOSQTHPoolPrice])

  return {
    ethPrice: ethPoolPrice,
    oSqthPrice: osqthPoolPrice,
    loading,
  }
}

import { useQuery } from '@apollo/client'
import { POOLS_QUERY } from '@queries/squeeth/poolQuery'
import { pools } from '@queries/squeeth/__generated__/pools'
import { squeethClient } from '@utils/apollo-client'
import { BigNumber } from 'bignumber.js'
import { useAtomValue } from 'jotai'
import { useMemo } from 'react'
import { addressAtom, networkIdAtom } from 'src/state/wallet/atoms'

export default function useCurrentPrices() {
  const address = useAtomValue(addressAtom)
  const networkId = useAtomValue(networkIdAtom)

  const { data: { pools } = {}, loading } = useQuery<pools>(POOLS_QUERY, {
    client: squeethClient[networkId],
    skip: !address,
    pollInterval: 10000,
  })

  const ethPrice = useMemo(() => {
    if (!pools?.[0]) {
      return new BigNumber(0)
    }

    return new BigNumber(pools[0].token0Price)
  }, [pools])

  const sqthPrice = useMemo(() => {
    if (!pools?.[0] || !pools[1]) {
      return new BigNumber(0)
    }

    return new BigNumber(new BigNumber(pools[1]?.token1Price).times(new BigNumber(pools[0]?.token0Price)))
  }, [pools])

  return {
    ethPrice,
    sqthPrice,
    loading,
  }
}

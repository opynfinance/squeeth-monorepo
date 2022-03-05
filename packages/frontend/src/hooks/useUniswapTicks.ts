import { useQuery } from '@apollo/client'
import { Tick } from '@uniswap/v3-sdk'

import { ticks, ticksVariables } from '../queries/uniswap/__generated__/ticks'
import TICKS_QUERY from '../queries/uniswap/ticksQuery'
import { useAddresses } from './useAddress'

const useUniswapTicks = () => {
  const { squeethPool } = useAddresses()
  const { data, loading } = useQuery<ticks, ticksVariables>(TICKS_QUERY, {
    variables: { poolAddress: squeethPool },
  })

  const ticks = data?.ticks
    .map((d) => new Tick({ index: d.tickIdx, liquidityGross: d.liquidityGross, liquidityNet: d.liquidityNet }))
    .sort((t1, t2) => t1.index - t2.index)

  return {
    ticks,
    loading,
  }
}

export default useUniswapTicks

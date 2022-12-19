import { useQuery } from '@apollo/client'
import BULL_REBALANCE_QUERY from '@queries/squeeth/bullHedgeQuery'
import { bullHedges } from '@queries/squeeth/__generated__/bullHedges'
import { networkIdAtom } from '@state/wallet/atoms'
import { BullRebalanceType } from '../types'
import { squeethClient } from '@utils/apollo-client'
import { useAtomValue } from 'jotai'
import { useMemo } from 'react'

export const useBullHedgeHistory = () => {
  const networkId = useAtomValue(networkIdAtom)

  const { data, loading } = useQuery<bullHedges>(BULL_REBALANCE_QUERY, {
    fetchPolicy: 'cache-and-network',
    client: squeethClient[networkId],
  })

  const uiData = useMemo(() => {
    if (loading || !data) return []

    const fullRebalances = data.fullRebalances.map((tx) => ({
      tx: tx.id,
      type: BullRebalanceType.FULL_REBALANCE,
      id: tx.id,
      wPowerPerpAmount: tx.wPowerPerpAmount,
      isDepositingInCrab: tx.isDepositingInCrab,
      timestamp: tx.timestamp,
      isSellingUsdc: undefined,
    }))

    const leverageRebalances = data.leverageRebalances.map((tx) => ({
      tx: tx.id,
      type: BullRebalanceType.LEVERAGE_REBALANCE,
      id: tx.id,
      isSellingUsdc: tx.isSellingUsdc,
      usdcAmount: tx.usdcAmount,
      timestamp: tx.timestamp,
      isDepositingInCrab: undefined,
    }))

    return [...fullRebalances, ...leverageRebalances].sort((a, b) => b.timestamp - a.timestamp)
  }, [data, loading])

  return {
    loading,
    transactions: uiData,
  }
}

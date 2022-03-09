import { BIG_ZERO } from '../constants'
import { useEffect, useMemo, useState } from 'react'
import { useUserCrabTxHistory } from './useUserCrabTxHistory'
import { CrabStrategyTxType } from '../types'
import { useIndex } from 'src/state/controller/hooks'
import { toTokenAmount } from '@utils/calculations'
import { crabLoadingAtom, currentEthValueAtom } from 'src/state/crab/atoms'
import { useAtomValue } from 'jotai'
import { useTokenBalance } from './contracts/useTokenBalance'
import { addressesAtom } from 'src/state/positions/atoms'

export const useCrabPosition = (user: string) => {
  const crabLoading = useAtomValue(crabLoadingAtom)
  const currentEthValue = useAtomValue(currentEthValueAtom)

  const { crabStrategy } = useAtomValue(addressesAtom)
  const { loading, data } = useUserCrabTxHistory(user)
  const userCrabBalance = useTokenBalance(crabStrategy, 5, 18)

  const index = useIndex()
  const ethIndexPrice = toTokenAmount(index, 18).sqrt()

  const [minCurrentEth, setMinCurrentEth] = useState(BIG_ZERO)
  const [minCurrentUsd, setMinCurrentUsd] = useState(BIG_ZERO)

  const { depositedEth, usdAmount: depositedUsd } = useMemo(() => {
    if (loading || !data) return { depositedEth: BIG_ZERO, usdAmount: BIG_ZERO }

    const { depositedEth, usdAmount } = data?.reduce(
      (acc, tx) => {
        if (tx.type === CrabStrategyTxType.FLASH_DEPOSIT) {
          acc.depositedEth = acc.depositedEth.plus(tx.ethAmount)
          acc.lpAmount = acc.lpAmount.plus(tx.lpAmount)
          acc.usdAmount = acc.usdAmount.plus(tx.ethUsdValue)
        } else if (tx.type === CrabStrategyTxType.FLASH_WITHDRAW) {
          acc.depositedEth = acc.depositedEth.minus(tx.ethAmount)
          acc.lpAmount = acc.lpAmount.minus(tx.lpAmount)
          acc.usdAmount = acc.usdAmount.minus(tx.ethUsdValue)
        }
        // Reset to zero if position closed
        if (acc.lpAmount.isZero()) {
          acc.depositedEth = BIG_ZERO
          acc.usdAmount = BIG_ZERO
        }

        return acc
      },
      { depositedEth: BIG_ZERO, lpAmount: BIG_ZERO, usdAmount: BIG_ZERO },
    )

    return { depositedEth, usdAmount }
  }, [data?.length, loading])

  useEffect(() => {
    if (crabLoading) return
    calculateCurrentValue()
  }, [
    userCrabBalance.toString(),
    depositedEth.toString(),
    ethIndexPrice.toString(),
    crabLoading,
    currentEthValue.toString(),
  ])

  const calculateCurrentValue = async () => {
    setMinCurrentEth(currentEthValue)
    setMinCurrentUsd(currentEthValue.times(ethIndexPrice))
  }

  const { minPnL, minPnlUsd } = useMemo(() => {
    const minPnlUsd = minCurrentUsd.minus(depositedUsd)
    const minPnL = minPnlUsd.div(depositedUsd).times(100)
    return { minPnlUsd, minPnL }
  }, [depositedUsd.toString(), minCurrentUsd.toString()])

  return {
    depositedEth,
    depositedUsd,
    minCurrentEth,
    minCurrentUsd,
    minPnL,
    minPnlUsd,
    loading: crabLoading || loading,
  }
}

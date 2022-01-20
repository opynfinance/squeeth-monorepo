import { BIG_ZERO } from '../constants'
import { useEffect, useMemo, useState } from 'react'
import { useUserCrabTxHistory } from './useUserCrabTxHistory'
import { CrabStrategyTxType } from '../types'
import { useUsdAmount } from './useUsdAmount'
import { useCrab } from '@context/crabStrategy'
import { useWorldContext } from '@context/world'

export const useCrabPosition = (user: string) => {
  const { loading, data } = useUserCrabTxHistory(user)
  const { getUsdAmt } = useUsdAmount()
  const {
    getCollateralFromCrabAmount,
    calculateEthWillingToPay,
    loading: crabLoading,
    userCrabBalance,
    vaultId,
    currentEthValue,
  } = useCrab()
  const { ethPrice } = useWorldContext()

  const [minCurrentEth, setMinCurrentEth] = useState(BIG_ZERO)
  const [minCurrentUsd, setMinCurrentUsd] = useState(BIG_ZERO)

  const { depositedEth, usdAmount: depositedUsd } = useMemo(() => {
    if (loading || !data) return { depositedEth: BIG_ZERO, usdAmount: BIG_ZERO }

    const { depositedEth, usdAmount } = data?.reduce(
      (acc, tx) => {
        const usdAmt = getUsdAmt(tx.ethAmount, tx.timestamp)
        if (tx.type === CrabStrategyTxType.FLASH_DEPOSIT) {
          acc.depositedEth = acc.depositedEth.plus(tx.ethAmount)
          acc.lpAmount = acc.lpAmount.plus(tx.lpAmount)
          acc.usdAmount = acc.usdAmount.plus(usdAmt)
        } else if (tx.type === CrabStrategyTxType.FLASH_WITHDRAW) {
          acc.depositedEth = acc.depositedEth.minus(tx.ethAmount)
          acc.lpAmount = acc.lpAmount.minus(tx.lpAmount)
          acc.usdAmount = acc.usdAmount.minus(usdAmt)
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
  }, [loading])

  useEffect(() => {
    if (crabLoading) return
    calculateCurrentValue()
  }, [
    userCrabBalance.toString(),
    depositedEth.toString(),
    ethPrice.toString(),
    crabLoading,
    currentEthValue.toString(),
  ])

  const calculateCurrentValue = async () => {
    setMinCurrentEth(currentEthValue)
    setMinCurrentUsd(currentEthValue.times(ethPrice))
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

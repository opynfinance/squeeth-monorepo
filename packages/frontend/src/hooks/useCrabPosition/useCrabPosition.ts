import { BIG_ZERO } from '../../constants'
import { useEffect, useState } from 'react'
import { useUserCrabTxHistory } from '../useUserCrabTxHistory'
import { CrabStrategyTxType } from '../../types'
import { toTokenAmount } from '@utils/calculations'
import { useAtomValue } from 'jotai'
import { indexAtom } from 'src/state/controller/atoms'
import useAppCallback from '../useAppCallback'
import useAppMemo from '../useAppMemo'
import { crabLoadingAtom, currentEthValueAtom } from 'src/state/crab/atoms'

export const useCrabPosition = (user: string) => {
  const crabLoading = useAtomValue(crabLoadingAtom)
  const currentEthValue = useAtomValue(currentEthValueAtom)

  const { loading: txHistoryLoading, data: txHistoryData } = useUserCrabTxHistory(user)

  const index = useAtomValue(indexAtom)
  const ethIndexPrice = toTokenAmount(index, 18).sqrt()

  const [minCurrentEth, setMinCurrentEth] = useState(BIG_ZERO)
  const [minCurrentUsd, setMinCurrentUsd] = useState(BIG_ZERO)
  const [minPnlUsd, setMinPnlUsd] = useState(BIG_ZERO)
  const [minPnL, setMinPnL] = useState(BIG_ZERO)

  const { depositedEth, usdAmount: depositedUsd } = useAppMemo(() => {
    if (txHistoryLoading || !txHistoryData) return { depositedEth: BIG_ZERO, usdAmount: BIG_ZERO }

    const { depositedEth, usdAmount } = txHistoryData?.reduce(
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
  }, [txHistoryData, txHistoryLoading])

  const calculateCurrentValue = useAppCallback(async () => {
    const minCurrentUsd = currentEthValue.times(ethIndexPrice)
    const minPnlUsd = minCurrentUsd.minus(depositedUsd)

    setMinCurrentEth(currentEthValue)
    setMinCurrentUsd(minCurrentUsd)

    setMinPnlUsd(minPnlUsd)
    setMinPnL(minPnlUsd.div(depositedUsd).times(100))
  }, [currentEthValue, depositedUsd, ethIndexPrice])

  useEffect(() => {
    if (crabLoading || txHistoryLoading) return
    calculateCurrentValue()
  }, [calculateCurrentValue, crabLoading, txHistoryLoading])

  return {
    depositedEth,
    depositedUsd,
    minCurrentEth,
    minCurrentUsd,
    minPnL,
    minPnlUsd,
    loading: crabLoading || txHistoryLoading,
  }
}

/*
AC:
loading
  should be true if either transaction history or crab is loading.
  should be false if both of them are loaded

depositedEth and depositedUsd
  should be zero if transaction history is loading.
  should be caculated as correct values if transaction history is loaded

minCurrentEth and minCurrentUsd
  should be zero if either transaction history or crab is loading.
  should be caculated as correct values if both of them are loaded

minPnL and minPnlUsd
  same as above


Dependencies:
  crabLoadingAtom
  currentEthValueAtom
  indexAtom
  useUserCrabTxHistory
*/

import { BIG_ZERO } from '../../constants'
import { useEffect, useState } from 'react'
import { useUserCrabTxHistory } from '../useUserCrabTxHistory'
import { useUserCrabV2TxHistory } from '../useUserCrabV2TxHistory'
import { CrabStrategyTxType, CrabStrategyV2TxType } from '../../types'
import { toTokenAmount } from '@utils/calculations'
import { useAtomValue } from 'jotai'
import { indexAtom } from 'src/state/controller/atoms'
import useAppCallback from '../useAppCallback'
import useAppMemo from '../useAppMemo'
import {
  crabLoadingAtom,
  crabLoadingAtomV2,
  crabPositionValueLoadingAtom,
  crabPositionValueLoadingAtomV2,
  currentCrabPositionValueInETHAtom,
  currentCrabPositionValueInETHAtomV2,
} from 'src/state/crab/atoms'
import BigNumber from 'bignumber.js'

/*
  depositedEth = Sum of deposited ethAmount - Sum of withdrawn ethAmount
  depositedUsd = Sum of deposited ethUsed - Sum of withdrawn ethUsd
  minCurrentEth = currentEth 
  minCurrentUsd = currentEth * indexPrice
  minPnlUsd = minCurrentUsd - depositedUsd
  minPnL = minPnlUsd / depositedUsd * 100
*/
export const useCrabPosition = (user: string) => {
  const crabLoading = useAtomValue(crabLoadingAtom)
  const isCrabPositionValueLoading = useAtomValue(crabPositionValueLoadingAtom)
  const currentEthValue = useAtomValue(currentCrabPositionValueInETHAtom)

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
    if (crabLoading || txHistoryLoading || isCrabPositionValueLoading) return
    calculateCurrentValue()
  }, [calculateCurrentValue, crabLoading, isCrabPositionValueLoading, txHistoryLoading])

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
  depositedEth = Sum of deposited ethAmount - Sum of withdrawn ethAmount
  depositedUsd = Sum of deposited ethUsed - Sum of withdrawn ethUsd
  minCurrentEth = currentEth 
  minCurrentUsd = currentEth * indexPrice
  minPnlUsd = minCurrentUsd - depositedUsd
  minPnL = minPnlUsd / depositedUsd * 100
*/
export const useCrabPositionV2 = (user: string) => {
  const crabLoading = useAtomValue(crabLoadingAtomV2)
  const isCrabPositionValueLoading = useAtomValue(crabPositionValueLoadingAtomV2)
  const currentEthValue = useAtomValue(currentCrabPositionValueInETHAtomV2)

  const { loading: txHistoryLoading, data: txHistoryData } = useUserCrabV2TxHistory(user)

  const index = useAtomValue(indexAtom)
  const ethIndexPrice = toTokenAmount(index, 18).sqrt()

  const [minCurrentEth, setMinCurrentEth] = useState(BIG_ZERO)
  const [minCurrentUsd, setMinCurrentUsd] = useState(BIG_ZERO)
  const [minPnlUsd, setMinPnlUsd] = useState(BIG_ZERO)
  const [minPnL, setMinPnL] = useState(BIG_ZERO)

  const { depositedEth,depositedValueUsd: depositedValueUsd,remainingDepositUsd,remainingDepositEth  } = useAppMemo(() => {
    if (txHistoryLoading || !txHistoryData) return { depositedEth: BIG_ZERO, depositedValueUsd: BIG_ZERO, withdrawnEth: BIG_ZERO, withdrawnValueUsd: BIG_ZERO, remainingShares : BIG_ZERO, remainingDepositUsd: BIG_ZERO, remainingDepositEth: BIG_ZERO }

  
    let { depositedEth,depositedValueUsd,withdrawnEth, withdrawnValueUsd, depositedLpAmount, withdrawnLpAmount, netLpAmount } = txHistoryData?.reduce(
      (acc, tx) => {
        if (
          tx.type === CrabStrategyV2TxType.FLASH_DEPOSIT ||
          tx.type === CrabStrategyV2TxType.DEPOSIT ||
          tx.type === CrabStrategyV2TxType.DEPOSIT_V1
        ) {
          acc.depositedEth = acc.depositedEth.plus(tx.ethAmount)
          acc.depositedValueUsd = acc.depositedValueUsd.plus(tx.ethUsdValue)
          acc.depositedLpAmount = acc.depositedLpAmount.plus(tx.lpAmount)
          acc.netLpAmount = acc.netLpAmount.plus(tx.lpAmount)
          

        } else if (tx.type === CrabStrategyV2TxType.FLASH_WITHDRAW || tx.type === CrabStrategyV2TxType.WITHDRAW) {
          acc.withdrawnEth = acc.withdrawnEth.plus(tx.ethAmount)
          acc.withdrawnValueUsd = acc.withdrawnValueUsd.plus(tx.ethUsdValue)
          acc.withdrawnLpAmount = acc.withdrawnLpAmount.plus(tx.lpAmount)
          acc.netLpAmount = acc.netLpAmount.minus(tx.lpAmount)
        }
        return acc
      },
      { depositedEth: BIG_ZERO, depositedValueUsd: BIG_ZERO, withdrawnEth: BIG_ZERO, withdrawnValueUsd: BIG_ZERO, depositedLpAmount: BIG_ZERO,withdrawnLpAmount : BIG_ZERO, netLpAmount: BIG_ZERO},
    )

   depositedEth = (netLpAmount.isZero())? BIG_ZERO : depositedEth
   depositedValueUsd = (netLpAmount.isZero())? BIG_ZERO : depositedValueUsd
   const remainingShares =  (netLpAmount.isZero())? BIG_ZERO : new BigNumber(1).minus(withdrawnLpAmount.dividedBy(depositedLpAmount))
   const remainingDepositUsd = (netLpAmount.isZero())? BIG_ZERO : remainingShares.multipliedBy(depositedValueUsd)
   const remainingDepositEth = (netLpAmount.isZero())? BIG_ZERO : remainingShares.multipliedBy(depositedEth)
   
    return { depositedEth, depositedValueUsd, withdrawnEth, withdrawnValueUsd, remainingShares,remainingDepositUsd,remainingDepositEth }
  }, [txHistoryData, txHistoryLoading])

  const calculateCurrentValue = useAppCallback(async () => {
    const minCurrentUsd = currentEthValue.times(ethIndexPrice)
    const minPnlUsd = minCurrentUsd.minus(depositedValueUsd)

    setMinCurrentEth(currentEthValue)
    setMinCurrentUsd(minCurrentUsd)

    setMinPnlUsd(minPnlUsd)
    setMinPnL(minPnlUsd.div(depositedValueUsd).times(100))
  }, [currentEthValue,depositedValueUsd, ethIndexPrice])

  useEffect(() => {
    if (crabLoading || txHistoryLoading || isCrabPositionValueLoading) return
    calculateCurrentValue()
  }, [calculateCurrentValue, crabLoading, isCrabPositionValueLoading, txHistoryLoading])

  return {
    depositedEth,
    depositedValueUsd,
    minCurrentEth,
    minCurrentUsd,
    minPnL,
    minPnlUsd,
    loading: crabLoading || txHistoryLoading,
    remainingDepositUsd,
    remainingDepositEth
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

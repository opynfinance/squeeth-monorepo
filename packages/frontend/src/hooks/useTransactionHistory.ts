import BigNumber from 'bignumber.js'
import { useAtomValue } from 'jotai'

import { TransactionType } from '../constants'
import { useUserCrabTxHistory } from './useUserCrabTxHistory'
import { CrabStrategyTxType } from '../types'
import { addressAtom } from 'src/state/wallet/atoms'
import { addressesAtom, isWethToken0Atom, swapsAtom } from 'src/state/positions/atoms'
import { useEthPriceMap } from 'src/state/ethPriceCharts/atoms'
import { useLiquidityTxHistory } from 'src/state/transactions/hooks'

export const useTransactionHistory = () => {
  const { shortHelper } = useAtomValue(addressesAtom)
  const address = useAtomValue(addressAtom)
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const ethPriceMap = useEthPriceMap()
  const swapsData = useAtomValue(swapsAtom)
  const swaps = swapsData?.swaps
  const { addRemoveLiquidityTrans: liquidityTxs, loading: liquidityTxloading } = useLiquidityTxHistory()
  const { data: crabTxs, loading: crabTxLoading } = useUserCrabTxHistory(address || '')

  const transactions =
    ethPriceMap &&
    (swaps || []).map((s) => {
      const squeethAmount = new BigNumber(isWethToken0 ? s.amount1 : s.amount0)
      const ethAmount = new BigNumber(isWethToken0 ? s.amount0 : s.amount1)
      const time = new Date(Number(s.timestamp) * 1000).setUTCHours(0, 0, 0) / 1000
      const usdValue = ethAmount.multipliedBy(ethPriceMap[time]).abs()

      let transactionType = TransactionType.BUY
      if (squeethAmount.isPositive() && s.recipient.toLowerCase() !== shortHelper.toLowerCase()) {
        transactionType = TransactionType.SELL
      } else if (s.recipient.toLowerCase() === shortHelper.toLowerCase()) {
        if (squeethAmount.isNegative()) transactionType = TransactionType.BURN_SHORT
        if (squeethAmount.isPositive()) transactionType = TransactionType.MINT_SHORT
      }

      return {
        squeethAmount: squeethAmount.abs(),
        ethAmount: ethAmount.abs(),
        usdValue,
        timestamp: s.timestamp,
        transactionType,
        txId: s.transaction.id,
        ethPriceAtDeposit: new BigNumber(ethPriceMap[time]),
      }
    })

  const crabTransactions = (crabTxs || [])?.map((c) => {
    const transactionType =
      c.type === CrabStrategyTxType.FLASH_DEPOSIT
        ? TransactionType.CRAB_FLASH_DEPOSIT
        : TransactionType.CRAB_FLASH_WITHDRAW
    const { oSqueethAmount: squeethAmount, ethAmount, ethUsdValue: usdValue, timestamp } = c

    return {
      transactionType,
      squeethAmount: squeethAmount.abs(),
      ethAmount: ethAmount.abs(),
      usdValue,
      timestamp,
      txId: c.id,
    }
  })

  return {
    transactions: [...(transactions || []), ...(liquidityTxs || []), ...crabTransactions].sort(
      (transactionA, transactionB) => transactionB.timestamp - transactionA.timestamp,
    ),
    loading: crabTxLoading || liquidityTxloading,
  }
}

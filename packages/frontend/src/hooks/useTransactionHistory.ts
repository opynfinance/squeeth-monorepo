import BigNumber from 'bignumber.js'
import { useAtomValue } from 'jotai'

import { OSQUEETH_DECIMALS, TransactionType, WETH_DECIMALS } from '../constants'
import { useUserCrabTxHistory } from './useUserCrabTxHistory'
import { CrabStrategyTxType } from '../types'
import { addressAtom } from 'src/state/wallet/atoms'
import useTransactionHistories from './useTransactionHistories'
import { toTokenAmount } from '@utils/calculations'

export const useTransactionHistory = () => {
  const address = useAtomValue(addressAtom)
  const transactionHistories = useTransactionHistories()

  const { data: crabData } = useUserCrabTxHistory(address || '')

  const transactions = (transactionHistories || []).map((s) => {
    const squeethAmount = toTokenAmount(s.oSqthAmount, OSQUEETH_DECIMALS)
    const ethAmount = toTokenAmount(s.ethAmount, WETH_DECIMALS)

    return {
      squeethAmount: squeethAmount.abs(),
      ethAmount: ethAmount.abs(),
      usdValue: ethAmount.abs().times(s.ethPriceInUSD),
      timestamp: s.timestamp,
      transactionType: TransactionType[s.transactionType],
      txId: s.id.split('-')[0],
      ethPriceAtDeposit: s.ethPriceInUSD,
    }
  })

  const crabTransactions = (crabData || [])?.map((c) => {
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
    transactions: [...(transactions || []), ...crabTransactions].sort(
      (transactionA, transactionB) => transactionB.timestamp - transactionA.timestamp,
    ),
  }
}

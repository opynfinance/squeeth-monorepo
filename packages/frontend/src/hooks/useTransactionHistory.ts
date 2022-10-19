import { useQuery } from '@apollo/client'
import BigNumber from 'bignumber.js'
import { useAtomValue } from 'jotai'

import { TransactionType } from '../constants'
import {
  transactions,
  transactionsVariables,
  transactions_positionSnapshots,
} from '../queries/uniswap/__generated__/transactions'
import TRANSACTIONS_QUERY from '../queries/uniswap/transactionsQuery'
import { useUserCrabTxHistory } from './useUserCrabTxHistory'
import { useUserCrabV2TxHistory } from './useUserCrabV2TxHistory'
import { CrabStrategyTxType } from '../types'
import { CrabStrategyV2TxType } from '../types'
import { addressAtom } from 'src/state/wallet/atoms'
import { addressesAtom, isWethToken0Atom, swapsAtom } from 'src/state/positions/atoms'
import { useEthPriceMap } from 'src/state/ethPriceCharts/atoms'

const bigZero = new BigNumber(0)

export const useTransactionHistory = () => {
  const { squeethPool, shortHelper, swapRouter } = useAtomValue(addressesAtom)
  const address = useAtomValue(addressAtom)
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const ethPriceMap = useEthPriceMap()
  const swapsData = useAtomValue(swapsAtom)
  const swaps = swapsData?.swaps

  const { data, loading } = useQuery<transactions, transactionsVariables>(TRANSACTIONS_QUERY, {
    variables: {
      poolAddress: squeethPool,
      owner: address || '',
      origin: address || '',
      recipients: [shortHelper, address || '', swapRouter],
      orderDirection: 'desc',
    },
    fetchPolicy: 'cache-and-network',
  })

  const { data: crabData } = useUserCrabTxHistory(address || '')
  const { data: crabV2Data } = useUserCrabV2TxHistory(address || '')

  const addRemoveLiquidityTrans =
    ethPriceMap &&
    (data?.positionSnapshots || []).map(
      (transaction: transactions_positionSnapshots, index: number, array: transactions_positionSnapshots[]) => {
        const transactionDetails = {
          squeethAmount: new BigNumber(isWethToken0 ? transaction.depositedToken1 : transaction.depositedToken0),
          ethAmount: new BigNumber(isWethToken0 ? transaction.depositedToken0 : transaction.depositedToken1),
          usdValue: bigZero,
          timestamp: transaction.transaction.timestamp,
          transactionType: TransactionType.ADD_LIQUIDITY,
          txId: transaction.transaction.id,
          ethPriceAtDeposit: bigZero,
        }

        const squeethDepositedAmount = new BigNumber(
          isWethToken0 ? transaction.depositedToken1 : transaction.depositedToken0,
        )
        const ethDepositedAmount = new BigNumber(
          isWethToken0 ? transaction.depositedToken0 : transaction.depositedToken1,
        )
        const squeethWithdrawnAmount = new BigNumber(
          isWethToken0 ? transaction.withdrawnToken1 : transaction.withdrawnToken0,
        )
        const ethWithdrawnAmount = new BigNumber(
          isWethToken0 ? transaction.withdrawnToken0 : transaction.withdrawnToken1,
        )

        const prevSqueethDepositedAmount = new BigNumber(
          // Index + 1 here is because the array is ordered from latest to oldest
          isWethToken0 ? array[index + 1]?.depositedToken1 : array[index + 1]?.depositedToken0,
        )
        const prevEthDepositedAmount = new BigNumber(
          isWethToken0 ? array[index + 1]?.depositedToken0 : array[index + 1]?.depositedToken1,
        )
        const prevSqueethWithdrawnAmount = new BigNumber(
          isWethToken0 ? array[index + 1]?.withdrawnToken1 : array[index + 1]?.withdrawnToken0,
        )
        const prevEthWithdrawnAmount = new BigNumber(
          isWethToken0 ? array[index + 1]?.withdrawnToken0 : array[index + 1]?.withdrawnToken1,
        )

        if (squeethDepositedAmount.isGreaterThan(prevSqueethDepositedAmount)) {
          transactionDetails.squeethAmount = squeethDepositedAmount.minus(prevSqueethDepositedAmount)
          transactionDetails.ethAmount = ethDepositedAmount.minus(prevEthDepositedAmount)
          transactionDetails.transactionType = TransactionType.ADD_LIQUIDITY
        } else if (squeethWithdrawnAmount.isGreaterThan(prevSqueethWithdrawnAmount)) {
          transactionDetails.squeethAmount = squeethWithdrawnAmount.minus(prevSqueethWithdrawnAmount)
          transactionDetails.ethAmount = ethWithdrawnAmount.minus(prevEthWithdrawnAmount)
          transactionDetails.transactionType = TransactionType.REMOVE_LIQUIDITY
        }

        const time = new Date(Number(transaction.transaction.timestamp) * 1000).setUTCHours(0, 0, 0) / 1000
        const usdValue = transactionDetails.ethAmount.multipliedBy(ethPriceMap[time]).abs()

        return { ...transactionDetails, usdValue, ethPriceAtDeposit: new BigNumber(ethPriceMap[time]) }
      },
    )

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

  const crabV2Transactions = (crabV2Data || [])?.map((c) => {
    const transactionType =
      c.type === CrabStrategyV2TxType.FLASH_DEPOSIT || c.type === CrabStrategyV2TxType.DEPOSIT_V1
        ? c.erc20Token
          ? TransactionType.CRAB_V2_USDC_FLASH_DEPOSIT
          : TransactionType.CRAB_V2_FLASH_DEPOSIT
        : c.erc20Token
        ? TransactionType.CRAB_V2_USDC_FLASH_WITHDRAW
        : TransactionType.CRAB_V2_FLASH_WITHDRAW
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
    transactions: [
      ...(transactions || []),
      ...(addRemoveLiquidityTrans || []),
      ...crabTransactions,
      ...crabV2Transactions,
    ].sort((transactionA, transactionB) => transactionB.timestamp - transactionA.timestamp),
    loading,
  }
}

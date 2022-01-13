import { useQuery } from '@apollo/client'
import BigNumber from 'bignumber.js'

import { TransactionType } from '../constants'
import { useWallet } from '@context/wallet'
import { useWorldContext } from '@context/world'
import { transactions_swaps, transactions_positionSnapshots } from '../queries/uniswap/__generated__/transactions'
import TRANSACTIONS_QUERY from '../queries/uniswap/transactionsQuery'
import { useAddresses } from './useAddress'

const bigZero = new BigNumber(0)

export const useTransactionHistory = () => {
  const { squeethPool, weth, wSqueeth, shortHelper, swapRouter } = useAddresses()
  const { address } = useWallet()
  const { ethPriceMap } = useWorldContext()

  const { data, loading } = useQuery(TRANSACTIONS_QUERY, {
    variables: {
      poolAddress: squeethPool.toLowerCase(),
      owner: address?.toLowerCase(),
      origin: address || '',
      recipients: [shortHelper, address || '', swapRouter],
      orderDirection: 'desc',
    },
    fetchPolicy: 'cache-and-network',
  })

  const isWethToken0 = parseInt(weth, 16) < parseInt(wSqueeth, 16)

  const addRemoveLiquidityTrans = (data?.positionSnapshots || []).map(
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
      const ethDepositedAmount = new BigNumber(isWethToken0 ? transaction.depositedToken0 : transaction.depositedToken1)
      const squeethWithdrawnAmount = new BigNumber(
        isWethToken0 ? transaction.withdrawnToken1 : transaction.withdrawnToken0,
      )
      const ethWithdrawnAmount = new BigNumber(isWethToken0 ? transaction.withdrawnToken0 : transaction.withdrawnToken1)

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

  const transactions = (data?.swaps || []).map((s: transactions_swaps) => {
    const squeethAmount = new BigNumber(isWethToken0 ? s.amount1 : s.amount0)
    const ethAmount = new BigNumber(isWethToken0 ? s.amount0 : s.amount1)
    const time = new Date(Number(s.timestamp) * 1000).setUTCHours(0, 0, 0) / 1000
    const usdValue = ethAmount.multipliedBy(ethPriceMap[time]).abs()

    let transactionType = TransactionType.BUY
    if (squeethAmount.isPositive() && s.recipient.toLowerCase() === swapRouter.toLowerCase()) {
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

  return {
    transactions: [...transactions, ...addRemoveLiquidityTrans].sort(
      (transactionA, transactionB) => transactionB.timestamp - transactionA.timestamp,
    ),
    loading,
  }
}

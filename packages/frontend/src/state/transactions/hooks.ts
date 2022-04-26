import { useAtom, useAtomValue } from 'jotai'
import BigNumber from 'bignumber.js'
import { useQuery } from '@apollo/client'
import { useEffect } from 'react'

import { networkIdAtom, addressAtom } from '../wallet/atoms'
import { addressesAtom, isWethToken0Atom } from '../positions/atoms'
import { useEthPriceMap } from '../ethPriceCharts/atoms'

import { TRANSACTIONS_QUERY, TRANSACTIONS_SUBSCRIPTION } from '@queries/uniswap/transactionsQuery'
import { transactions_positionSnapshots } from '@queries/uniswap/__generated__/transactions'
import { BIG_ZERO, TransactionType } from '@constants/index'

export const useLiquidityTxHistory = () => {
  const [networkId] = useAtom(networkIdAtom)
  const [address] = useAtom(addressAtom)
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const ethPriceMap = useEthPriceMap()

  const { squeethPool, crabStrategy } = useAtomValue(addressesAtom)

  const { subscribeToMore, data, refetch, loading, error, startPolling, stopPolling } = useQuery(TRANSACTIONS_QUERY, {
    variables: {
      poolAddress: squeethPool,
      owner: address,
      orderDirection: 'desc',
    },
    fetchPolicy: 'cache-and-network',
  })

  useEffect(() => {
    subscribeToMore({
      document: TRANSACTIONS_SUBSCRIPTION,
      variables: {
        poolAddress: squeethPool,
        owner: address,
        orderDirection: 'desc',
      },
      updateQuery(prev, { subscriptionData }) {
        if (!subscriptionData.data) return prev
        const positionSnapshots = subscriptionData.data.positionSnapshots
        return {
          positionSnapshots: positionSnapshots,
        }
      },
    })
  }, [address, crabStrategy, networkId, squeethPool, subscribeToMore])

  const addRemoveLiquidityTrans =
    ethPriceMap &&
    (data?.positionSnapshots || []).map(
      (transaction: transactions_positionSnapshots, index: number, array: transactions_positionSnapshots[]) => {
        const transactionDetails = {
          squeethAmount: new BigNumber(isWethToken0 ? transaction.depositedToken1 : transaction.depositedToken0),
          ethAmount: new BigNumber(isWethToken0 ? transaction.depositedToken0 : transaction.depositedToken1),
          usdValue: BIG_ZERO,
          timestamp: transaction.transaction.timestamp,
          transactionType: TransactionType.ADD_LIQUIDITY,
          txId: transaction.transaction.id,
          ethPriceAtDeposit: BIG_ZERO,
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

  return { data, addRemoveLiquidityTrans, refetch, loading, error, startPolling, stopPolling }
}

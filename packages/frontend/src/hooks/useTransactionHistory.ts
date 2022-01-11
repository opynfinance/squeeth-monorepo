import { useQuery } from '@apollo/client'
import BigNumber from 'bignumber.js'

import { TransactionType } from '../constants'
import { useWallet } from '@context/wallet'
import { useWorldContext } from '@context/world'
import { swaps, swapsVariables } from '../queries/uniswap/__generated__/swaps'
import SWAPS_QUERY from '../queries/uniswap/swapsQuery'
import { useAddresses } from './useAddress'

const bigZero = new BigNumber(0)

export const useTransactionHistory = () => {
  const { squeethPool, weth, wSqueeth, shortHelper, swapRouter } = useAddresses()
  const { address } = useWallet()
  const { ethPriceMap } = useWorldContext()
  const { data, loading } = useQuery<swaps, swapsVariables>(SWAPS_QUERY, {
    variables: {
      poolAddress: squeethPool.toLowerCase(),
      origin: address || '',
      recipients: [shortHelper, address || '', swapRouter],
      orderDirection: 'desc',
    },
    fetchPolicy: 'cache-and-network',
  })

  const isWethToken0 = parseInt(weth, 16) < parseInt(wSqueeth, 16)

  const transactions = (data?.swaps || []).map((s) => {
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
    }
  })

  return {
    transactions,
    loading,
  }
}

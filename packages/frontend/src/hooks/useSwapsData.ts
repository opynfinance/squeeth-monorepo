import { useCallback, useEffect, useMemo } from 'react'
import BigNumber from 'bignumber.js'
import { useQuery } from '@apollo/client'

import { useWallet } from '@context/wallet'
import { BIG_ZERO } from '@constants/index'
import { useAddresses } from '../hooks/useAddress'
import { useUsdAmount } from '../hooks/useUsdAmount'
import { swaps, swapsVariables } from '../queries/uniswap/__generated__/swaps'
import SWAPS_QUERY, { SWAPS_SUBSCRIPTION } from '../queries/uniswap/swapsQuery'

export const useSwapsData = () => {
  const { squeethPool, weth, oSqueeth, shortHelper, swapRouter } = useAddresses()
  const { address } = useWallet()
  const { getUsdAmt } = useUsdAmount()
  const { data, subscribeToMore, refetch } = useQuery<swaps, swapsVariables>(SWAPS_QUERY, {
    variables: {
      poolAddress: squeethPool?.toLowerCase(),
      origin: address || '',
      recipients: [shortHelper, address || '', swapRouter],
      orderDirection: 'asc',
    },
    fetchPolicy: 'cache-and-network',
  })

  useEffect(() => {
    subscribeToNewPositions()
  }, [])

  const subscribeToNewPositions = useCallback(() => {
    subscribeToMore({
      document: SWAPS_SUBSCRIPTION,
      variables: {
        poolAddress: squeethPool?.toLowerCase(),
        origin: address || '',
        recipients: [shortHelper, address || '', swapRouter],
        orderDirection: 'asc',
      },
      updateQuery(prev, { subscriptionData }) {
        if (!subscriptionData.data) return prev
        const newSwaps = subscriptionData.data.swaps
        return {
          swaps: newSwaps,
        }
      },
    })
  }, [address, shortHelper, squeethPool, subscribeToMore, swapRouter])
  const swaps = data?.swaps
  const isWethToken0 = parseInt(weth, 16) < parseInt(oSqueeth, 16)
  const {
    squeethAmount,
    wethAmount,
    longRealizedSqueeth,
    totalUSDSpent,
    longRealizedUSD,
    longTotalSqueeth,
    shortRealizedSqueeth,
    shortRealizedUSD,
    totalUSDReceived,
    shortTotalSqueeth,
    longUsdAmount,
    shortUsdAmount,
  } = useMemo(
    () =>
      swaps?.reduce(
        (acc, s) => {
          //values are all from the pool pov
          //if >0 for the pool, user gave some squeeth to the pool, meaning selling the squeeth
          const squeethAmt = new BigNumber(isWethToken0 ? s.amount1 : s.amount0)
          const wethAmt = new BigNumber(isWethToken0 ? s.amount0 : s.amount1)
          const usdAmt = getUsdAmt(wethAmt, s.timestamp)

          //buy one squeeth means -1 to the pool, +1 to the user
          acc.squeethAmount = acc.squeethAmount.plus(squeethAmt.negated())
          acc.wethAmount = acc.wethAmount.plus(wethAmt.negated())

          //<0 means, buying squeeth
          //>0 means selling squeeth

          if (squeethAmt.isPositive()) {
            acc.shortTotalSqueeth = acc.shortTotalSqueeth.plus(squeethAmt.abs())
            acc.totalUSDReceived = acc.totalUSDReceived.plus(usdAmt.abs())
            acc.longRealizedSqueeth = acc.longRealizedSqueeth.plus(squeethAmt.abs())
            acc.longRealizedUSD = acc.longRealizedUSD.plus(usdAmt.abs())
          } else if (squeethAmt.isNegative()) {
            acc.shortRealizedSqueeth = acc.shortRealizedSqueeth.plus(squeethAmt.abs())
            acc.shortRealizedUSD = acc.shortRealizedUSD.plus(usdAmt.abs())
            acc.longTotalSqueeth = acc.longTotalSqueeth.plus(squeethAmt.abs())
            acc.totalUSDSpent = acc.totalUSDSpent.plus(usdAmt.abs())
          }

          if (acc.squeethAmount.isZero()) {
            acc.longUsdAmount = BIG_ZERO
            acc.shortUsdAmount = BIG_ZERO
            acc.wethAmount = BIG_ZERO
            acc.longTotalSqueeth = BIG_ZERO
            acc.shortTotalSqueeth = BIG_ZERO
            acc.totalUSDSpent = BIG_ZERO
          } else {
            // when the position is partially closed, will accumulate usdamount
            acc.longUsdAmount = acc.longUsdAmount.plus(usdAmt)
            acc.shortUsdAmount = acc.shortUsdAmount.plus(usdAmt.negated())
            acc.wethAmount = acc.wethAmount.plus(wethAmt.negated())
          }

          return acc
        },
        {
          squeethAmount: BIG_ZERO,
          wethAmount: BIG_ZERO,
          longUsdAmount: BIG_ZERO,
          shortUsdAmount: BIG_ZERO,
          totalUSDSpent: BIG_ZERO,
          shortTotalSqueeth: BIG_ZERO,
          totalUSDReceived: BIG_ZERO,
          longTotalSqueeth: BIG_ZERO,
          shortRealizedSqueeth: BIG_ZERO,
          shortRealizedUSD: BIG_ZERO,
          longRealizedSqueeth: BIG_ZERO,
          longRealizedUSD: BIG_ZERO,
        },
      ) || {
        squeethAmount: BIG_ZERO,
        wethAmount: BIG_ZERO,
        longUsdAmount: BIG_ZERO,
        shortUsdAmount: BIG_ZERO,
        totalUSDSpent: BIG_ZERO,
        shortTotalSqueeth: BIG_ZERO,
        totalUSDReceived: BIG_ZERO,
        longTotalSqueeth: BIG_ZERO,
        shortRealizedSqueeth: BIG_ZERO,
        shortRealizedUSD: BIG_ZERO,
        longRealizedSqueeth: BIG_ZERO,
        longRealizedUSD: BIG_ZERO,
      },
    [isWethToken0, swaps?.length],
  )

  return {
    squeethAmount,
    wethAmount,
    longRealizedSqueeth,
    totalUSDSpent,
    longRealizedUSD,
    longTotalSqueeth,
    shortRealizedSqueeth,
    shortRealizedUSD,
    totalUSDReceived,
    shortTotalSqueeth,
    longUsdAmount,
    shortUsdAmount,
    swaps,
    refetch,
  }
}

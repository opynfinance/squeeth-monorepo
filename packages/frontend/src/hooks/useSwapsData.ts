import { useCallback, useEffect, useMemo } from 'react'
import BigNumber from 'bignumber.js'
import { useQuery } from '@apollo/client'

import { useWallet } from '@context/wallet'
import { BIG_ZERO } from '@constants/index'
import { useAddresses } from '../hooks/useAddress'
import { useUsdAmount } from '../hooks/useUsdAmount'
import { swaps, swapsVariables } from '../queries/uniswap/__generated__/swaps'
import SWAPS_QUERY, { SWAPS_SUBSCRIPTION } from '../queries/uniswap/swapsQuery'
import { Networks } from '../types'
import SWAPS_ROPSTEN_QUERY, { SWAPS_ROPSTEN_SUBSCRIPTION } from '@queries/uniswap/swapsRopstenQuery'
import { swapsRopsten, swapsRopstenVariables } from '@queries/uniswap/__generated__/swapsRopsten'

export const useSwapsData = () => {
  const { squeethPool, weth, oSqueeth, shortHelper, swapRouter, crabStrategy } = useAddresses()
  const { address, networkId } = useWallet()
  const { getUsdAmt } = useUsdAmount()
  const { data, subscribeToMore, refetch } = useQuery<swaps | swapsRopsten, swapsVariables | swapsRopstenVariables>(
    networkId === Networks.MAINNET ? SWAPS_QUERY : SWAPS_ROPSTEN_QUERY,
    {
      variables: {
        origin: address || '',
        orderDirection: 'asc',
        recipient_not: crabStrategy,
        ...(networkId === Networks.MAINNET
          ? {
              tokenAddress: oSqueeth,
            }
          : {
              poolAddress: squeethPool,
              recipients: [shortHelper, address || '', swapRouter],
            }),
      },
      fetchPolicy: 'cache-and-network',
    },
  )

  useEffect(() => {
    subscribeToMore({
      document: networkId === Networks.MAINNET ? SWAPS_SUBSCRIPTION : SWAPS_ROPSTEN_SUBSCRIPTION,
      variables: {
        origin: address || '',
        orderDirection: 'asc',
        recipient_not: crabStrategy,
        ...(networkId === Networks.MAINNET
          ? {
              tokenAddress: oSqueeth,
            }
          : {
              poolAddress: squeethPool,
              recipients: [shortHelper, address || '', swapRouter],
            }),
      },
      updateQuery(prev, { subscriptionData }) {
        if (!subscriptionData.data) return prev
        const newSwaps = subscriptionData.data.swaps
        return {
          swaps: newSwaps,
        }
      },
    })
  }, [address, oSqueeth, subscribeToMore])

  const swaps = data?.swaps
  const isWethToken0 = parseInt(weth, 16) < parseInt(oSqueeth, 16)
  const { squeethAmount, wethAmount, totalUSDFromBuy, boughtSqueeth, totalUSDFromSell, soldSqueeth, shortUsdAmount } =
    useMemo(
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

            //<0 means, buying squeeth
            //>0 means selling squeeth
            if (squeethAmt.isPositive()) {
              //replacing longRealizedSqueeth and shortTotalSqueeth
              acc.soldSqueeth = acc.soldSqueeth.plus(squeethAmt.abs())
              //replacing totalUSDReceived and longRealizedUSD
              acc.totalUSDFromSell = acc.totalUSDFromSell.plus(usdAmt.abs())
            } else if (squeethAmt.isNegative()) {
              //replacing shortRealizedSqueeth and longTotalSqueeth
              acc.boughtSqueeth = acc.boughtSqueeth.plus(squeethAmt.abs())

              //replacing shortRealizedUSD and totalUSDSpent
              acc.totalUSDFromBuy = acc.totalUSDFromBuy.plus(usdAmt.abs())
            }

            if (acc.squeethAmount.isZero()) {
              acc.longUsdAmount = BIG_ZERO
              acc.shortUsdAmount = BIG_ZERO
              acc.wethAmount = BIG_ZERO
              acc.boughtSqueeth = BIG_ZERO
              acc.soldSqueeth = BIG_ZERO
              acc.totalUSDFromSell = BIG_ZERO
              acc.totalUSDFromBuy = BIG_ZERO
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
            boughtSqueeth: BIG_ZERO,
            soldSqueeth: BIG_ZERO,
            totalUSDFromBuy: BIG_ZERO,
            totalUSDFromSell: BIG_ZERO,
          },
        ) || {
          squeethAmount: BIG_ZERO,
          wethAmount: BIG_ZERO,
          longUsdAmount: BIG_ZERO,
          shortUsdAmount: BIG_ZERO,
          boughtSqueeth: BIG_ZERO,
          soldSqueeth: BIG_ZERO,
          totalUSDFromBuy: BIG_ZERO,
          totalUSDFromSell: BIG_ZERO,
        },
      [isWethToken0, swaps?.length],
    )
  return {
    squeethAmount,
    wethAmount,
    totalUSDFromBuy,
    boughtSqueeth,
    totalUSDFromSell,
    soldSqueeth,
    shortUsdAmount,
    swaps,
    refetch,
    isWethToken0,
  }
}

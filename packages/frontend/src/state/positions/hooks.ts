import { useAtom, useAtomValue } from 'jotai'
import { useQuery } from '@apollo/client'
import { useEffect, useMemo } from 'react'
import BigNumber from 'bignumber.js'

import { networkIdAtom, addressAtom } from '../wallet/atoms'
import { swaps } from '@queries/uniswap/__generated__/swaps'
import SWAPS_ROPSTEN_QUERY, { SWAPS_ROPSTEN_SUBSCRIPTION } from '@queries/uniswap/swapsRopstenQuery'

import { BIG_ZERO } from '@constants/index'
import { addressesAtom, isWethToken0Atom } from './atoms'
import { positions, positionsVariables } from '@queries/uniswap/__generated__/positions'
import POSITIONS_QUERY, { POSITIONS_SUBSCRIPTION } from '@queries/uniswap/positionsQuery'
import { useUsdAmount } from '@hooks/useUsdAmount'

export const useLPPositions = () => {
  const [{ squeethPool }] = useAtom(addressesAtom)
  const [address] = useAtom(addressAtom)

  const { data, error, refetch, loading, subscribeToMore } = useQuery<positions, positionsVariables>(POSITIONS_QUERY, {
    variables: {
      poolAddress: squeethPool?.toLowerCase(),
      owner: address?.toLowerCase() || '',
    },
    fetchPolicy: 'cache-and-network',
  })

  useEffect(() => {
    subscribeToMore({
      document: POSITIONS_SUBSCRIPTION,
      variables: {
        poolAddress: squeethPool?.toLowerCase(),
        owner: address?.toLowerCase() || '',
      },
      updateQuery(prev, { subscriptionData }) {
        if (!subscriptionData.data) return prev
        const newPosition = subscriptionData.data.positions
        return {
          positions: newPosition,
        }
      },
    })
  }, [address, squeethPool, subscribeToMore])

  return { data, error, refetch, loading }
}

export const useSwaps = () => {
  const [networkId] = useAtom(networkIdAtom)
  const [address] = useAtom(addressAtom)
  const [{ squeethPool, oSqueeth, shortHelper, swapRouter, crabStrategy }] = useAtom(addressesAtom)
  const { subscribeToMore, data, refetch, loading, error } = useQuery<swaps, any>(SWAPS_ROPSTEN_QUERY, {
    variables: {
      //   tokenAddress: oSqueeth?.toLowerCase(),
      origin: address || '',
      poolAddress: squeethPool?.toLowerCase(),
      recipients: [shortHelper, address || '', swapRouter],
      recipient_not: crabStrategy?.toLowerCase(),
      orderDirection: 'asc',
    },
    fetchPolicy: 'cache-and-network',
  })

  useEffect(() => {
    subscribeToMore({
      document: SWAPS_ROPSTEN_SUBSCRIPTION,
      variables: {
        // tokenAddress: oSqueeth?.toLowerCase(),
        origin: address || '',
        poolAddress: squeethPool?.toLowerCase(),
        recipients: [shortHelper, address || '', swapRouter],
        recipient_not: crabStrategy?.toLowerCase(),
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
  }, [address, crabStrategy, networkId, oSqueeth, shortHelper, squeethPool, swapRouter, subscribeToMore])

  return { data, refetch, loading, error }
}

export const useComputeSwaps = () => {
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const { getUsdAmt } = useUsdAmount()
  const { data } = useSwaps()

  return useMemo(
    () =>
      data?.swaps.reduce(
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
            //sold Squeeth amount
            acc.soldSqueeth = acc.soldSqueeth.plus(squeethAmt.abs())
            //usd value from sell to close long position or open short
            acc.totalUSDFromSell = acc.totalUSDFromSell.plus(usdAmt.abs())
          } else if (squeethAmt.isNegative()) {
            //bought Squeeth amount
            acc.boughtSqueeth = acc.boughtSqueeth.plus(squeethAmt.abs())
            //usd value from buy to close short position or open long
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
    [getUsdAmt, isWethToken0, data?.swaps.length],
  )
}

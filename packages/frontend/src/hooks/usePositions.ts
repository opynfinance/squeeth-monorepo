import { useQuery } from '@apollo/client'
import BigNumber from 'bignumber.js'

import { useWallet } from '../context/wallet'
import { useWorldContext } from '../context/world'
import { swaps, swapsVariables } from '../queries/uniswap/__generated__/swaps'
import SWAPS_QUERY from '../queries/uniswap/swapsQuery'
import { useAddresses } from './useAddress'
import useInterval from './useInterval'

const bigZero = new BigNumber(0)

export const useLongPositions = () => {
  const { squeethPool, weth, wSqueeth, swapRouter } = useAddresses()
  const { address } = useWallet()
  const { ethPriceMap } = useWorldContext()
  const { data, loading, refetch } = useQuery<swaps, swapsVariables>(SWAPS_QUERY, {
    variables: {
      poolAddress: squeethPool.toLowerCase(),
      origin: address || '',
      recipients: [address || '', swapRouter],
      orderDirection: 'asc',
    },
    fetchPolicy: 'cache-and-network',
  })

  useInterval(refetch, 5000)

  const swaps = data?.swaps
  const isWethToken0 = parseInt(weth, 16) < parseInt(wSqueeth, 16)

  const { squeethAmount, wethAmount, usdAmount } = swaps?.reduce(
    (acc, s) => {
      acc.squeethAmount = acc.squeethAmount.plus(new BigNumber(isWethToken0 ? s.amount1 : s.amount0).negated())
      acc.wethAmount = acc.wethAmount.plus(new BigNumber(isWethToken0 ? s.amount0 : s.amount1).negated())
      const time = new Date(Number(s.timestamp) * 1000).setUTCHours(0, 0, 0) / 1000
      acc.usdAmount = acc.usdAmount.plus(
        new BigNumber(isWethToken0 ? s.amount0 : s.amount1).negated().multipliedBy(ethPriceMap[time]),
      )
      if (acc.squeethAmount.isZero()) {
        acc.usdAmount = bigZero
        acc.wethAmount = bigZero
      }
      return acc
    },
    { squeethAmount: bigZero, wethAmount: bigZero, usdAmount: bigZero },
  ) || { squeethAmount: bigZero, wethAmount: bigZero, usdAmount: bigZero }

  return {
    swaps,
    loading,
    squeethAmount,
    wethAmount,
    usdAmount,
  }
}

export const useShortPositions = () => {
  const { squeethPool, weth, wSqueeth, shortHelper } = useAddresses()
  const { address } = useWallet()
  const { ethPriceMap } = useWorldContext()
  const { data, loading, refetch } = useQuery<swaps, swapsVariables>(SWAPS_QUERY, {
    variables: {
      poolAddress: squeethPool.toLowerCase(),
      origin: address || '',
      recipients: [shortHelper],
      orderDirection: 'asc',
    },
    fetchPolicy: 'cache-and-network',
  })

  useInterval(refetch, 5000)

  const swaps = data?.swaps
  const isWethToken0 = parseInt(weth, 16) < parseInt(wSqueeth, 16)

  const { squeethAmount, wethAmount, usdAmount } = swaps?.reduce(
    (acc, s) => {
      acc.squeethAmount = acc.squeethAmount.plus(new BigNumber(isWethToken0 ? s.amount1 : s.amount0).negated())
      acc.wethAmount = acc.wethAmount.plus(new BigNumber(isWethToken0 ? s.amount0 : s.amount1).negated())
      const time = new Date(Number(s.timestamp) * 1000).setUTCHours(0, 0, 0) / 1000
      acc.usdAmount = acc.usdAmount.plus(
        new BigNumber(isWethToken0 ? s.amount0 : s.amount1).negated().multipliedBy(ethPriceMap[time]),
      )
      if (acc.squeethAmount.isZero()) {
        acc.usdAmount = bigZero
        acc.wethAmount = bigZero
      }
      return acc
    },
    { squeethAmount: bigZero, wethAmount: bigZero, usdAmount: bigZero },
  ) || { squeethAmount: bigZero, wethAmount: bigZero, usdAmount: bigZero }

  return {
    swaps,
    loading,
    squeethAmount: squeethAmount.absoluteValue(),
    wethAmount,
    usdAmount,
  }
}

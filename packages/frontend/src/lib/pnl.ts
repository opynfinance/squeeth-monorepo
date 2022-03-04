import BigNumber from 'bignumber.js'
import { closestIndexTo, differenceInMinutes, format, subMinutes } from 'date-fns'
import { QueryClient } from 'react-query'

import { BIG_ZERO, TWELVEDATA_NO_PRICEDATA_DURATION } from '../constants/'
import { swaps_swaps } from '../queries/uniswap/__generated__/swaps'
import { VaultHistory_vaultHistories } from '../queries/squeeth/__generated__/VaultHistory'
import { toTokenAmount } from '@utils/calculations'
import { getHistoricEthPrice } from '@hooks/useETHPrice'
import { getETHWithinOneDayPrices } from '@hooks/useETHPriceCharts'
import { Action } from '../../types/global_apollo'

type ShortPnLParams = {
  wethAmount: BigNumber
  buyQuote: BigNumber
  ethPrice: BigNumber
}

export function calcUnrealizedPnl({ wethAmount, buyQuote, ethPrice }: ShortPnLParams) {
  if (
    wethAmount.isEqualTo(0) ||
    !wethAmount.isFinite() ||
    buyQuote.isEqualTo(0) ||
    !buyQuote.isFinite() ||
    ethPrice.isEqualTo(0) ||
    !ethPrice.isFinite()
  ) {
    return new BigNumber(0)
  }

  return wethAmount.minus(buyQuote).multipliedBy(ethPrice)
}

type ShortGainParams = {
  shortUnrealizedPNL: BigNumber
  usdAmount: BigNumber
  wethAmount: BigNumber
  uniswapEthPrice: BigNumber
}

export function calcShortGain({ shortUnrealizedPNL, usdAmount, wethAmount, uniswapEthPrice }: ShortGainParams) {
  if (
    wethAmount.isEqualTo(0) ||
    shortUnrealizedPNL.isEqualTo(0) ||
    uniswapEthPrice.isEqualTo(0) ||
    usdAmount.isEqualTo(0)
  ) {
    return new BigNumber(0)
  }
  return shortUnrealizedPNL.div(usdAmount.plus(wethAmount.times(uniswapEthPrice).absoluteValue())).times(100)
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
    },
  },
})

export async function calcETHCollateralPnl(
  data: VaultHistory_vaultHistories[] | undefined,
  uniswapEthPrice: BigNumber,
  currentVaultEthBalance: BigNumber,
) {
  const { deposits, withdrawals, priceError } = data?.length
    ? await data?.reduce(async (prevPromise, vaultHistory: VaultHistory_vaultHistories) => {
        const acc = await prevPromise

        const ethPriceAtTimeOfAction = await getEthPriceAtTransactionTime(vaultHistory.timestamp)

        if (ethPriceAtTimeOfAction?.isZero()) {
          acc.priceError = true
        }
        if (vaultHistory.action === Action.DEPOSIT_COLLAT) {
          acc.deposits = acc.deposits.plus(
            new BigNumber(toTokenAmount(vaultHistory.ethCollateralAmount, 18)).times(ethPriceAtTimeOfAction),
          )
        } else if (vaultHistory.action === Action.WITHDRAW_COLLAT) {
          acc.withdrawals = acc.withdrawals.plus(
            new BigNumber(toTokenAmount(vaultHistory.ethCollateralAmount, 18)).times(ethPriceAtTimeOfAction),
          )
        }
        return acc
      }, Promise.resolve({ deposits: BIG_ZERO, withdrawals: BIG_ZERO, priceError: false }))
    : { deposits: BIG_ZERO, withdrawals: BIG_ZERO, priceError: true }

  return !priceError ? currentVaultEthBalance.times(uniswapEthPrice).minus(deposits.minus(withdrawals)) : BIG_ZERO
}
/**
 * getRelevantSwaps - gets the swaps that constitute the users current position
 * @param squeethAmount
 * @param swaps
 * @param isWethToken0
 * @param isLong
 * @returns array of swaps that add up to the user's squeethAmount
 */
const getRelevantSwaps = (squeethAmount: BigNumber, swaps: swaps_swaps[], isWethToken0: boolean, isLong = false) => {
  let totalSqueeth = BIG_ZERO
  const relevantSwaps = []
  for (let index = swaps.length - 1; index >= 0; index--) {
    const squeethAmountFromSwapsData = new BigNumber(isWethToken0 ? swaps[index].amount1 : swaps[index].amount0)
    // squeethAmountFromSwaps data from uniswap is -ve when it's a buy and +ve when it's a sell
    const sqthAmount = isLong ? squeethAmountFromSwapsData.negated() : squeethAmountFromSwapsData
    totalSqueeth = totalSqueeth.plus(sqthAmount)
    relevantSwaps.push(swaps[index])

    //checking if the squeethAmount of the swaps in the relevantSwaps array add up to the user's position
    if (squeethAmount.isEqualTo(totalSqueeth)) {
      break
    }
  }
  return relevantSwaps
}

export async function calcDollarShortUnrealizedpnl(
  swaps: swaps_swaps[],
  isWethToken0: boolean,
  buyQuote: BigNumber,
  uniswapEthPrice: BigNumber,
  squeethAmount: BigNumber,
  ethCollateralPnl: BigNumber,
) {
  const relevantSwaps = getRelevantSwaps(squeethAmount, swaps, isWethToken0)

  const { totalWethInUSD, priceError } = await relevantSwaps.reduce(async (prevPromise, swap: any, index) => {
    const acc = await prevPromise
    const wethAmt = new BigNumber(isWethToken0 ? swap.amount0 : swap.amount1)

    const ethPriceWhenOpened = await getEthPriceAtTransactionTime(swap.timestamp)

    if (ethPriceWhenOpened?.isZero()) {
      acc.priceError = true
    }

    acc.totalWethInUSD = acc.totalWethInUSD.plus(wethAmt.negated().times(ethPriceWhenOpened))

    return acc
  }, Promise.resolve({ totalWethInUSD: BIG_ZERO, priceError: false }))

  const usd = totalWethInUSD.minus(buyQuote.times(uniswapEthPrice)).plus(ethCollateralPnl)

  return {
    usd,
    eth: usd.div(uniswapEthPrice),
    loading: priceError,
  }
}

export async function calcDollarLongUnrealizedpnl(
  swaps: swaps_swaps[],
  isWethToken0: boolean,
  sellQuote: {
    amountOut: BigNumber
    minimumAmountOut: BigNumber
    priceImpact: string
  },
  uniswapEthPrice: BigNumber,
  squeethAmount: BigNumber,
) {
  const relevantSwaps = getRelevantSwaps(squeethAmount, swaps, isWethToken0, true)

  const { totalUSDWethAmount, priceError } = await relevantSwaps.reduce(async (prevPromise, swap: any) => {
    const acc = await prevPromise
    const wethAmt = new BigNumber(isWethToken0 ? swap.amount0 : swap.amount1)

    const ethPriceWhenOpened = await getEthPriceAtTransactionTime(swap.timestamp)

    if (ethPriceWhenOpened?.isZero()) {
      acc.priceError = true
    }

    acc.totalUSDWethAmount = acc.totalUSDWethAmount.plus(wethAmt.times(ethPriceWhenOpened ?? BIG_ZERO))

    return acc
  }, Promise.resolve({ totalUSDWethAmount: BIG_ZERO, priceError: false }))

  const usdValue = !priceError ? sellQuote.amountOut.times(uniswapEthPrice).minus(totalUSDWethAmount) : BIG_ZERO
  return {
    usd: usdValue,
    eth: !usdValue.isZero() ? usdValue.div(uniswapEthPrice) : BIG_ZERO,
    loading: priceError,
  }
}

const historicPriceQueryKeys = {
  historicPrice: (timestamp: string) => [`userPrice_${timestamp}`],
}

async function getEthPriceAtTransactionTime(timestamp: string) {
  try {
    const timeInMilliseconds = new Date(Number(timestamp) * 1000).setUTCSeconds(0, 0)
    const currentTimeInMilliseconds = Date.now()
    // Gets difference in minutes between the current time
    // and the timestamp for which ethPrice data is being requested
    const diff = differenceInMinutes(currentTimeInMilliseconds, timeInMilliseconds, { roundingMethod: 'round' })

    if (diff < TWELVEDATA_NO_PRICEDATA_DURATION) {
      // call coingecko
      const priceData = await queryClient.fetchQuery(
        historicPriceQueryKeys.historicPrice(timestamp),
        () => getETHWithinOneDayPrices(),
        {
          staleTime: Infinity,
        },
      )

      if (priceData.length === 1) {
        // call twelvedata
        const dateTimeString = format(
          new Date(subMinutes(new Date(), TWELVEDATA_NO_PRICEDATA_DURATION)).setUTCSeconds(0),
          'yyyy-MM-dd HH:mm:ss',
        )
        return await queryClient.fetchQuery(
          historicPriceQueryKeys.historicPrice(timestamp),
          () => getHistoricEthPrice(dateTimeString),
          {
            staleTime: Infinity,
          },
        )
      }

      const dateList = priceData.map((item) => item.time)
      const dateIndex = closestIndexTo(timeInMilliseconds, dateList)

      if (dateIndex) {
        return new BigNumber(priceData[dateIndex].value)
      }

      const dateTimeString = format(
        new Date(subMinutes(new Date(), TWELVEDATA_NO_PRICEDATA_DURATION)).setUTCSeconds(0),
        'yyyy-MM-dd HH:mm:ss',
      )
      return await queryClient.fetchQuery(
        historicPriceQueryKeys.historicPrice(timestamp),
        () => getHistoricEthPrice(dateTimeString),
        {
          staleTime: Infinity,
        },
      )
    }

    // call twelvedata
    const dateTimeString = format(new Date(timeInMilliseconds), 'yyyy-MM-dd HH:mm:ss')

    return await queryClient.fetchQuery(
      historicPriceQueryKeys.historicPrice(timestamp),
      () => getHistoricEthPrice(dateTimeString),
      {
        staleTime: Infinity,
      },
    )
  } catch (error) {
    return BIG_ZERO
  }
}

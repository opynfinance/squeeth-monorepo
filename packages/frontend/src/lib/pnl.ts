import BigNumber from 'bignumber.js'
import { closestIndexTo, differenceInMinutes, format, subMinutes } from 'date-fns'
import { QueryClient } from 'react-query'

import { BIG_ZERO, TWELVEDATA_NO_PRICEDATA_DURATION } from '../constants/'
import { swaps_swaps } from '../queries/uniswap/__generated__/swaps'
import { VaultHistory_vaultHistories } from '../queries/squeeth/__generated__/VaultHistory'
import { toTokenAmount } from '@utils/calculations'
import { getHistoricEthPrice, getHistoricEthPrices } from '@hooks/useETHPrice'
import { getETHWithinOneDayPrices } from '@utils/ethPriceCharts'
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
  const vaultHistories = await getVaultHistoriesWithEthPrice(data || [])
  const { deposits, withdrawals, priceError } = vaultHistories.reduce(
    (acc, vaultHistory) => {
      const ethPriceAtTimeOfAction = vaultHistory.ethPrice

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
    },
    { deposits: BIG_ZERO, withdrawals: BIG_ZERO, priceError: false },
  )

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

export function pnl(currentValue: BigNumber, cost: BigNumber): BigNumber {
  return currentValue.minus(cost)
}

export function pnlInPerct(currentValue: BigNumber, cost: BigNumber): BigNumber {
  if (cost.isEqualTo(0)) return BIG_ZERO
  return currentValue.dividedBy(cost).minus(1).times(100)
}

export function pnlv2(currentValue: BigNumber, remainingDeposit: BigNumber): BigNumber {
  return (currentValue).minus(remainingDeposit)
}

export function pnlInPerctv2(currentValue: BigNumber, remainingDeposit: BigNumber): BigNumber {
  if (remainingDeposit.isEqualTo(0)) return BIG_ZERO
  return (currentValue).dividedBy(remainingDeposit).minus(1).times(100)
}

const getSwapsWithEthPrice = async (swaps: swaps_swaps[]) => {
  const timestamps = swaps.map((s) => Number(s.timestamp) * 1000)

  // Don't fetch if already fetched
  const ethPriceMap = await queryClient.fetchQuery(timestamps, () => getHistoricEthPrices(timestamps), {
    staleTime: Infinity,
  })

  const swapsWithEthPrice = swaps.map((s) => ({
    ...s,
    ethPrice: new BigNumber(ethPriceMap[Number(s.timestamp) * 1000]),
  }))

  return swapsWithEthPrice
}

const getVaultHistoriesWithEthPrice = async (vaultHistories: VaultHistory_vaultHistories[]) => {
  const timestamps = vaultHistories.map((v) => Number(v.timestamp) * 1000)

  // Don't fetch if already fetched
  const ethPriceMap = await queryClient.fetchQuery(timestamps, () => getHistoricEthPrices(timestamps), {
    staleTime: Infinity,
  })

  const historyWithEthPrice = vaultHistories.map((v) => ({
    ...v,
    ethPrice: new BigNumber(ethPriceMap[Number(v.timestamp) * 1000]),
  }))

  return historyWithEthPrice
}

export async function calcDollarShortUnrealizedpnl(
  swaps: swaps_swaps[],
  isWethToken0: boolean,
  positionValue: BigNumber,
  uniswapEthPrice: BigNumber,
  squeethAmount: BigNumber,
  ethCollateralPnl: BigNumber,
) {
  const relevantSwaps = getRelevantSwaps(squeethAmount, swaps, isWethToken0)
  const relevantSwapsWithEthPrice = await getSwapsWithEthPrice(relevantSwaps)

  const { totalWethInUSD, priceError } = relevantSwapsWithEthPrice.reduce(
    (acc, swap, index) => {
      const wethAmt = new BigNumber(isWethToken0 ? swap.amount0 : swap.amount1)

      const ethPriceWhenOpened = swap.ethPrice

      if (ethPriceWhenOpened?.isZero()) {
        acc.priceError = true
      }

      acc.totalWethInUSD = acc.totalWethInUSD.plus(wethAmt.negated().times(ethPriceWhenOpened))

      return acc
    },
    { totalWethInUSD: BIG_ZERO, priceError: false },
  )

  const usd = totalWethInUSD.minus(positionValue).plus(ethCollateralPnl)

  return {
    usd,
    eth: usd.div(uniswapEthPrice),
    loading: priceError,
  }
}

export async function calcDollarLongUnrealizedpnl(
  swaps: swaps_swaps[],
  isWethToken0: boolean,
  positionValue: BigNumber,
  uniswapEthPrice: BigNumber,
  squeethAmount: BigNumber,
) {
  const relevantSwaps = getRelevantSwaps(squeethAmount, swaps, isWethToken0, true)
  const relevantSwapsWithEthPrice = await getSwapsWithEthPrice(relevantSwaps)

  const { totalUSDWethAmount, priceError } = relevantSwapsWithEthPrice.reduce(
    (acc, swap) => {
      const wethAmt = new BigNumber(isWethToken0 ? swap.amount0 : swap.amount1)

      const ethPriceWhenOpened = swap.ethPrice

      if (ethPriceWhenOpened?.isZero()) {
        acc.priceError = true
      }

      acc.totalUSDWethAmount = acc.totalUSDWethAmount.plus(wethAmt.times(ethPriceWhenOpened ?? BIG_ZERO))

      return acc
    },
    { totalUSDWethAmount: BIG_ZERO, priceError: false },
  )

  const usdValue = !priceError ? positionValue.minus(totalUSDWethAmount) : BIG_ZERO
  return {
    usd: usdValue,
    eth: !usdValue.isZero() ? usdValue.div(uniswapEthPrice) : BIG_ZERO,
    loading: priceError,
  }
}

const historicPriceQueryKeys = {
  historicPrice: (timestamp: string) => [`userPrice_${timestamp}`],
}

/**
 * @deprecated
 */
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

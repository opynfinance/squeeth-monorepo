import BigNumber from 'bignumber.js'
import { closestIndexTo, differenceInMinutes, format, subMinutes } from 'date-fns'

import { BIG_ZERO } from '../constants/'
import { swaps_swaps } from '../queries/uniswap/__generated__/swaps'
import { VaultHistory_vaultHistories } from '../queries/squeeth/__generated__/VaultHistory'
import { toTokenAmount } from '@utils/calculations'
import { Action } from '@constants/enums'
import { getHistoricEthPrice } from '@hooks/useETHPrice'
import { getETHWithinOneDayPrices } from '@hooks/useETHPriceCharts'

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
  ethPrice: BigNumber
}

export function calcShortGain({ shortUnrealizedPNL, usdAmount, wethAmount, ethPrice }: ShortGainParams) {
  if (wethAmount.isEqualTo(0) || shortUnrealizedPNL.isEqualTo(0) || ethPrice.isEqualTo(0) || usdAmount.isEqualTo(0)) {
    return new BigNumber(0)
  }
  return shortUnrealizedPNL.div(usdAmount.plus(wethAmount.times(ethPrice).absoluteValue())).times(100)
}

export async function calcETHCollateralPnl(
  data: VaultHistory_vaultHistories[] | undefined,
  ethPrice: BigNumber,
  currentVaultEthBalance: BigNumber,
) {
  const { deposits, withdrawals } = data?.length
    ? await data?.reduce(async (prevPromise, vaultHistory: VaultHistory_vaultHistories) => {
        const acc = await prevPromise

        const ethPriceAtTimeOfAction = await getEthPriceAtTransactionTime(vaultHistory.timestamp)

        if (vaultHistory.action === Action.DEPOSIT_COLLAT) {
          acc.deposits = ethPriceAtTimeOfAction
            ? acc.deposits.plus(
                new BigNumber(toTokenAmount(vaultHistory.ethCollateralAmount, 18)).times(ethPriceAtTimeOfAction),
              )
            : BIG_ZERO
        } else if (vaultHistory.action === Action.WITHDRAW_COLLAT) {
          acc.withdrawals = acc.withdrawals.plus(
            new BigNumber(toTokenAmount(vaultHistory.ethCollateralAmount, 18)).times(ethPriceAtTimeOfAction),
          )
        }
        return acc
      }, Promise.resolve({ deposits: BIG_ZERO, withdrawals: BIG_ZERO }))
    : { deposits: BIG_ZERO, withdrawals: BIG_ZERO }

  return !deposits.minus(withdrawals).isZero()
    ? currentVaultEthBalance.times(ethPrice).minus(deposits.minus(withdrawals))
    : BIG_ZERO
}

export async function calcDollarShortUnrealizedpnl(
  swaps: swaps_swaps[],
  isWethToken0: boolean,
  buyQuote: BigNumber,
  ethPrice: BigNumber,
) {
  const { totalWethInUSD } = await swaps.reduce(async (prevPromise, swap: any) => {
    const acc = await prevPromise
    const squeethAmt = new BigNumber(isWethToken0 ? swap.amount1 : swap.amount0)
    const wethAmt = new BigNumber(isWethToken0 ? swap.amount0 : swap.amount1)

    const ethPriceWhenOpened = await getEthPriceAtTransactionTime(swap.timestamp)

    acc.totalWethInUSD = acc.totalWethInUSD.plus(wethAmt.negated().times(ethPriceWhenOpened))
    acc.totalSqueeth = acc.totalSqueeth.plus(squeethAmt)

    if (acc.totalSqueeth.isEqualTo(0)) {
      acc.totalWethInUSD = BIG_ZERO
    }

    return acc
  }, Promise.resolve({ totalWethInUSD: BIG_ZERO, totalSqueeth: BIG_ZERO }))

  return !totalWethInUSD.isZero() ? totalWethInUSD.minus(buyQuote.times(ethPrice)) : BIG_ZERO
}

export async function calcDollarLongUnrealizedpnl(
  swaps: swaps_swaps[],
  isWethToken0: boolean,
  sellQuote: {
    amountOut: BigNumber
    minimumAmountOut: BigNumber
    priceImpact: string
  },
  ethPrice: BigNumber,
) {
  const { totalUSDWethAmount } = await swaps.reduce(async (prevPromise, swap: any) => {
    const acc = await prevPromise
    const wethAmt = new BigNumber(isWethToken0 ? swap.amount0 : swap.amount1)
    const squeethAmt = new BigNumber(isWethToken0 ? swap.amount1 : swap.amount0)

    const ethPriceWhenOpened = await getEthPriceAtTransactionTime(swap.timestamp)
    acc.totalUSDWethAmount = acc.totalUSDWethAmount.plus(wethAmt.times(ethPriceWhenOpened ?? BIG_ZERO))
    acc.totalSqueeth = acc.totalSqueeth.plus(squeethAmt)

    if (acc.totalSqueeth.isEqualTo(0)) {
      //totalSqueeth being zero means a position has been completely closed, so reset totalUSDWethAmount.
      acc.totalUSDWethAmount = BIG_ZERO
    }

    return acc
  }, Promise.resolve({ totalUSDWethAmount: BIG_ZERO, totalSqueeth: BIG_ZERO }))

  const usdValue = sellQuote.amountOut.times(ethPrice).minus(totalUSDWethAmount)
  return {
    usd: usdValue,
    eth: !usdValue.isEqualTo(0) ? usdValue.div(ethPrice) : BIG_ZERO,
  }
}

async function getEthPriceAtTransactionTime(timestamp: string) {
  const timeInMilliseconds = new Date(Number(timestamp) * 1000).setUTCSeconds(0, 0)
  const currentTimeInMilliseconds = Date.now()
  // Gets difference in minutes between the current time
  // and the timestamp for which ethPrice data is being requested
  const diff = differenceInMinutes(currentTimeInMilliseconds, timeInMilliseconds, { roundingMethod: 'round' })

  if (diff < 62) {
    // call coingecko
    const priceData = await getETHWithinOneDayPrices()

    if (priceData.length === 1) {
      // call twelvedata
      const dateTimeString = format(new Date(subMinutes(new Date(), 62)).setUTCSeconds(0), 'yyyy-MM-dd HH:mm:ss')
      return await getHistoricEthPrice(dateTimeString)
    }

    const dateList = priceData.map((item) => item.time)
    const dateIndex = closestIndexTo(timeInMilliseconds, dateList)

    if (dateIndex) {
      return new BigNumber(priceData[dateIndex].value)
    }

    const dateTimeString = format(new Date(subMinutes(new Date(), 62)).setUTCSeconds(0), 'yyyy-MM-dd HH:mm:ss')
    return await getHistoricEthPrice(dateTimeString)
  }

  // call twelvedata
  const dateTimeString = format(new Date(timeInMilliseconds), 'yyyy-MM-dd HH:mm:ss')
  return await getHistoricEthPrice(dateTimeString)
}

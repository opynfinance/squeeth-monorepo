import BigNumber from 'bignumber.js'
import { differenceInMinutes, format, subMinutes } from 'date-fns'

import { BIG_ZERO } from '../constants/'
import { swaps_swaps } from '../queries/uniswap/__generated__/swaps'
import { VaultHistory_vaultHistories } from '../queries/squeeth/__generated__/VaultHistory'
import { toTokenAmount } from '@utils/calculations'
import { Action } from '@constants/enums'
import { getHistoricEthPrice } from '@hooks/useETHPrice'

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
  currentEthBalance: BigNumber,
) {
  const { deposits, withdrawals } = data?.length
    ? await data?.reduce(async (prevPromise, curr: VaultHistory_vaultHistories) => {
        const acc = await prevPromise

        const dateTimeString = getDateStringForPnl(curr.timestamp)
        const historicEthPrice = await getHistoricEthPrice(dateTimeString)

        if (curr.action === Action.DEPOSIT_COLLAT) {
          acc.deposits = historicEthPrice
            ? acc.deposits.plus(new BigNumber(toTokenAmount(curr.ethCollateralAmount, 18)).times(historicEthPrice))
            : BIG_ZERO
        } else if (curr.action === Action.WITHDRAW_COLLAT) {
          acc.withdrawals = acc.withdrawals.plus(
            new BigNumber(toTokenAmount(curr.ethCollateralAmount, 18)).times(historicEthPrice),
          )
        }
        return acc
      }, Promise.resolve({ deposits: BIG_ZERO, withdrawals: BIG_ZERO }))
    : { deposits: BIG_ZERO, withdrawals: BIG_ZERO }

  return currentEthBalance.times(ethPrice).isEqualTo(0) || deposits.minus(withdrawals).isEqualTo(0)
    ? BIG_ZERO
    : currentEthBalance.times(ethPrice).minus(deposits.minus(withdrawals))
}

export async function calcDollarShortUnrealizedpnl(
  swaps: swaps_swaps[],
  isWethToken0: boolean,
  buyQuote: BigNumber,
  ethPrice: BigNumber,
) {
  const { totalWethInUSD } = await swaps.reduce(async (prevPromise, curr: any) => {
    const acc = await prevPromise
    const squeethAmt = new BigNumber(isWethToken0 ? curr.amount1 : curr.amount0)
    const wethAmt = new BigNumber(isWethToken0 ? curr.amount0 : curr.amount1)

    const dateTimeString = getDateStringForPnl(curr.timestamp)

    const historicEthPrice = await getHistoricEthPrice(dateTimeString)

    acc.totalWethInUSD = acc.totalWethInUSD.plus(wethAmt.negated().times(historicEthPrice ?? BIG_ZERO))
    acc.totalSqueeth = acc.totalSqueeth.plus(squeethAmt)

    if (acc.totalSqueeth.isEqualTo(0)) {
      acc.totalWethInUSD = BIG_ZERO
    }

    return acc
  }, Promise.resolve({ sell: BIG_ZERO, buy: BIG_ZERO, totalWethInUSD: BIG_ZERO, totalSqueeth: BIG_ZERO }))

  return !buyQuote.isEqualTo(0) && !ethPrice.isEqualTo(0) ? totalWethInUSD.minus(buyQuote.times(ethPrice)) : BIG_ZERO
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
  const { totalUSDWethAmount } = await swaps.reduce(async (prevPromise, curr: any) => {
    const acc = await prevPromise
    const wethAmt = new BigNumber(isWethToken0 ? curr.amount0 : curr.amount1)
    const squeethAmt = new BigNumber(isWethToken0 ? curr.amount1 : curr.amount0)

    const dateTimeString = getDateStringForPnl(curr.timestamp)

    const ethPriceWhenOpened = await getHistoricEthPrice(dateTimeString)
    acc.totalUSDWethAmount = acc.totalUSDWethAmount.plus(wethAmt.times(ethPriceWhenOpened ?? BIG_ZERO))
    acc.totalSqueeth = acc.totalSqueeth.plus(squeethAmt)

    if (acc.totalSqueeth.isEqualTo(0)) {
      //totalSqueeth being zero means a position has been completely closed, so reset totalUSDWethAmount.
      acc.totalUSDWethAmount = BIG_ZERO
    }

    return acc
  }, Promise.resolve({ totalUSDWethAmount: BIG_ZERO, totalSqueeth: BIG_ZERO }))

  const usdValue =
    !sellQuote.amountOut.isEqualTo(0) && !ethPrice.isEqualTo(0)
      ? sellQuote.amountOut.times(ethPrice).minus(totalUSDWethAmount)
      : BIG_ZERO

  return {
    usd: usdValue,
    eth: !usdValue.isEqualTo(0) ? usdValue.div(ethPrice) : BIG_ZERO,
  }
}

function getDateStringForPnl(timestamp: string) {
  const timeInMilliseconds = new Date(Number(timestamp) * 1000).setUTCSeconds(0)
  const currentTimeInMilliseconds = Date.now()
  // Gets difference in minutes between the current time
  // and the timestamp for which ethPrice data is being requested
  const diff = differenceInMinutes(currentTimeInMilliseconds, timeInMilliseconds, { roundingMethod: 'round' })

  const dateTimeString =
    // 62 minutes represents the window within which TwelveData does not have ethPrice data
    diff < 62
      ? format(new Date(subMinutes(new Date(), 62)).setUTCSeconds(0), 'yyyy-MM-dd HH:mm:ss')
      : format(new Date(timeInMilliseconds), 'yyyy-MM-dd HH:mm:ss')

  return dateTimeString
}

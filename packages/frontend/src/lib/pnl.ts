import BigNumber from 'bignumber.js'

import { BIG_ZERO } from '../constants/'
import { swaps_swaps } from '../queries/uniswap/__generated__/swaps'
import { VaultHistory_vaultHistories } from '../queries/squeeth/__generated__/VaultHistory'
import { toTokenAmount } from '@utils/calculations'
import { Action } from '@constants/enums'

type ShortPnLParams = {
  wethAmount: BigNumber
  buyQuote: BigNumber
  ethPrice: BigNumber
  ethCollateralPnl: BigNumber
}

export function calcUnrealizedPnl({ wethAmount, buyQuote, ethPrice, ethCollateralPnl }: ShortPnLParams) {
  if (
    wethAmount.isEqualTo(0) ||
    !wethAmount.isFinite() ||
    buyQuote.isEqualTo(0) ||
    !buyQuote.isFinite() ||
    ethPrice.isEqualTo(0) ||
    !ethPrice.isFinite() ||
    ethCollateralPnl.isEqualTo(0) ||
    !ethCollateralPnl.isFinite()
  ) {
    return new BigNumber(0)
  }

  return buyQuote.minus(wethAmount).multipliedBy(ethPrice).plus(ethCollateralPnl)
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
export function calcLongUnrealizedPnl({
  sellQuote,
  wethAmount,
  ethPrice,
}: {
  sellQuote: BigNumber
  wethAmount: BigNumber
  ethPrice: BigNumber
}) {
  return {
    usdValue: sellQuote.minus(wethAmount.abs()).multipliedBy(ethPrice),
    ethValue: sellQuote.minus(wethAmount.abs()),
  }
}

export function calcETHCollateralPnl(
  data: VaultHistory_vaultHistories[] | undefined,
  ethPriceMap: { [key: string]: number },
  ethPrice: BigNumber,
  currentEthBalance: BigNumber,
) {
  const { deposits, withdrawals } = data?.length
    ? data?.reduce(
        (
          acc: {
            deposits: BigNumber
            withdrawals: BigNumber
          },
          curr: VaultHistory_vaultHistories,
        ) => {
          const time = new Date(Number(curr.timestamp) * 1000).setUTCHours(0, 0, 0) / 1000
          if (curr.action === Action.DEPOSIT_COLLAT) {
            acc.deposits = ethPriceMap[time]
              ? acc.deposits.plus(new BigNumber(toTokenAmount(curr.ethCollateralAmount, 18)).times(ethPriceMap[time]))
              : BIG_ZERO
          } else if (curr.action === Action.WITHDRAW_COLLAT) {
            acc.withdrawals = acc.withdrawals.plus(
              new BigNumber(toTokenAmount(curr.ethCollateralAmount, 18)).times(ethPriceMap[time]),
            )
          }
          return acc
        },
        { deposits: BIG_ZERO, withdrawals: BIG_ZERO },
      )
    : { deposits: BIG_ZERO, withdrawals: BIG_ZERO }

  return !currentEthBalance.times(ethPrice).isEqualTo(0) && !deposits.minus(withdrawals).isEqualTo(0)
    ? currentEthBalance.times(ethPrice).minus(deposits.minus(withdrawals))
    : BIG_ZERO
}

export async function calcDollarShortUnrealizedpnl(
  swaps: swaps_swaps[],
  isWethToken0: boolean,
  getBuyQuote: (squeethAmt: BigNumber) => Promise<{
    amountIn: BigNumber
    maximumAmountIn: BigNumber
    priceImpact: string
  }>,
  ethPrice: BigNumber,
  ethPriceMap: { [key: string]: number },
) {
  const result = swaps?.length
    ? swaps?.map(async (swap) => {
        const squeethAmt = new BigNumber(isWethToken0 ? swap.amount1 : swap.amount0)
        const wethAmt = new BigNumber(isWethToken0 ? swap.amount0 : swap.amount1)
        const buyQuote = await getBuyQuote(squeethAmt.abs())

        return {
          wethAmt: wethAmt.abs(),
          squeethAmt,
          buyQuote,
          timestamp: swap.timestamp,
        }
      })
    : []

  const data = await Promise.all(result)

  const { sell, buy } = data.reduce(
    (acc, curr: any) => {
      const time = new Date(Number(curr.timestamp) * 1000).setUTCHours(0, 0, 0) / 1000

      if (curr.squeethAmt.isPositive()) {
        acc.sell =
          !curr.buyQuote?.amountIn?.isEqualTo(0) && !curr.wethAmt.isEqualTo(0) && ethPriceMap[time]
            ? acc.sell.plus(
                curr.buyQuote?.amountIn?.times(ethPrice).minus(curr.wethAmt.times(new BigNumber(ethPriceMap[time]))),
              )
            : BIG_ZERO
      } else {
        acc.buy =
          !curr.buyQuote?.amountIn?.isEqualTo(0) && !curr.wethAmt.isEqualTo(0) && ethPriceMap[time]
            ? acc.buy.plus(
                curr.buyQuote?.amountIn?.times(ethPrice).minus(curr.wethAmt.times(new BigNumber(ethPriceMap[time]))),
              )
            : BIG_ZERO
      }
      return acc
    },
    { sell: BIG_ZERO, buy: BIG_ZERO },
  )

  return sell.minus(buy)
}

export async function calcDollarLongUnrealizedpnl(
  swaps: swaps_swaps[],
  isWethToken0: boolean,
  getSellQuote: (squeethAmt: BigNumber) => Promise<{
    amountOut: BigNumber
    minimumAmountOut: BigNumber
    priceImpact: string
  }>,
  ethPrice: BigNumber,
  ethPriceMap: { [key: string]: number },
) {
  const result = swaps?.length
    ? swaps?.map(async (swap) => {
        const squeethAmt = new BigNumber(isWethToken0 ? swap.amount1 : swap.amount0)
        const wethAmt = new BigNumber(isWethToken0 ? swap.amount0 : swap.amount1)
        const sellQuote = await getSellQuote(squeethAmt.abs())

        return {
          wethAmt: wethAmt.abs(),
          squeethAmt,
          sellQuote,
          timestamp: swap.timestamp,
        }
      })
    : []

  const data = await Promise.all(result)

  const { buy, sell } = data.reduce(
    (acc, curr: any) => {
      const time = new Date(Number(curr.timestamp) * 1000).setUTCHours(0, 0, 0) / 1000

      if (curr.squeethAmt.isNegative()) {
        acc.buy = !curr.sellQuote?.amountOut?.isEqualTo(0)
          ? acc.buy.plus(
              curr.sellQuote?.amountOut
                .times(ethPrice)
                .minus(curr.wethAmt.times(new BigNumber(ethPriceMap[time] ?? 0))),
            )
          : BIG_ZERO
      } else {
        acc.sell = !curr.sellQuote?.amountOut?.isEqualTo(0)
          ? acc.sell.plus(
              curr.sellQuote?.amountOut
                ?.times(ethPrice)
                .minus(curr.wethAmt.times(new BigNumber(ethPriceMap[time] ?? 0))),
            )
          : BIG_ZERO
      }
      return acc
    },
    { buy: BIG_ZERO, sell: BIG_ZERO },
  )

  return { usd: buy.minus(sell), eth: buy.minus(sell).div(ethPrice) }
}

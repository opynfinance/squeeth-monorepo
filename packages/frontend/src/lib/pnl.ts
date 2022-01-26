import BigNumber from 'bignumber.js'

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

  return wethAmount.minus(buyQuote).multipliedBy(ethPrice).plus(ethCollateralPnl)
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
) {
  return data?.length
    ? data?.reduce((acc: BigNumber, curr: VaultHistory_vaultHistories) => {
        const time = new Date(Number(curr.timestamp) * 1000).setUTCHours(0, 0, 0) / 1000
        if (curr.action === Action.DEPOSIT_COLLAT) {
          acc = acc.plus(
            new BigNumber(toTokenAmount(curr.ethCollateralAmount, 18)).times(
              new BigNumber(ethPriceMap[time]).minus(ethPrice),
            ),
          )
        }
        return acc
      }, new BigNumber(0))
    : new BigNumber(0)
}

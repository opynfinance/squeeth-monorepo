import BigNumber from 'bignumber.js'

type ShortPnLParams = {
  wethAmount: BigNumber
  buyQuote: BigNumber
  ethPrice: BigNumber
  ethCollateralPnl: BigNumber
}

export function calcUnrealizedPnl({ wethAmount, buyQuote, ethPrice, ethCollateralPnl }: ShortPnLParams) {
  if (wethAmount.isEqualTo(0) || buyQuote.isEqualTo(0) || ethPrice.isEqualTo(0) || ethCollateralPnl.isEqualTo(0)) {
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

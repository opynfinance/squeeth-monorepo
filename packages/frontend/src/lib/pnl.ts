import BigNumber from 'bignumber.js'

type ShortPnLParams = {
  wethAmount: BigNumber
  buyQuote: BigNumber
  ethPrice: BigNumber
}

export function calcUnrealizedPnl({ wethAmount, buyQuote, ethPrice }: ShortPnLParams) {
  if (wethAmount.isEqualTo(0) || buyQuote.isEqualTo(0) || ethPrice.isEqualTo(0)) {
    return new BigNumber(0)
  }
  return wethAmount.minus(buyQuote).multipliedBy(ethPrice)
}

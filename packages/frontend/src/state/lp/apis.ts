import BigNumber from 'bignumber.js'

export function getTickFromToken0Price(price: string) {
  return log1_0001(new BigNumber(price).toNumber())
}

export function getTickFromNormalPrice(price: string) {
  return log1_0001(new BigNumber(1).div(price).toNumber())
}

function log1_0001(num: number) {
  // eslint-disable-line
  return Math.log2(num) / Math.log2(1.0001)
}

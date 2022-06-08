import BigNumber from 'bignumber.js'

export default function useCurrentPrices() {
  return { ethPrice: new BigNumber(0), oSqthPrice: new BigNumber(0) }
}

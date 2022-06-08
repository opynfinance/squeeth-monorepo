import BigNumber from 'bignumber.js'
import useCurrentPrices from './useCurrentPrices'
import useTransactionHistories from './useTransactionHistories'

export default function usePnL() {
  const transactionHistories = useTransactionHistories()
  const { ethPrice, oSqthPrice } = useCurrentPrices()

  console.log(transactionHistories, ethPrice, oSqthPrice)

  return { unrealizePnL: new BigNumber(0), realizePnL: new BigNumber(0) }
}

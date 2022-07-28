import floatifyBigNums from '@utils/floatifyBigNums'
import BigNumber from 'bignumber.js'
import useAccount from './useAccount'
import useAppMemo from './useAppMemo'
import useCurrentPrices from './useCurrentPrices'

export default function usePnL() {
  const { account, loading: loadingAccount } = useAccount()
  const { ethPrice, sqthPrice, loading: loadingPrices } = useCurrentPrices()

  const { realizedPnL, unrealizedPnL, sqthAmount, sqthAmountInUSD } = useAppMemo(() => {
    if (!account) {
      return {
        realizedPnL: new BigNumber(0),
        unrealizedPnL: new BigNumber(0),
        sqthAmount: new BigNumber(0),
        sqthAmountInUSD: new BigNumber(0),
      }
    }

    const sqthOpenAmount = new BigNumber(account.sqthOpenAmount)
    const sqthOpenUnitPrice = new BigNumber(account.sqthOpenUnitPrice)
    const sqthCloseAmount = new BigNumber(account.sqthCloseAmount)
    const sqthCloseUnitPrice = new BigNumber(account.sqthCloseUnitPrice)
    const ethDepositAmount = new BigNumber(account.ethDepositAmount)
    const ethDepositUnitPrice = new BigNumber(account.ethDepositUnitPrice)
    const ethWithdrawAmount = new BigNumber(account.ethWithdrawAmount)
    const ethWithdrawUnitPrice = new BigNumber(account.ethWithdrawUnitPrice)
    const ethCollected = new BigNumber(account.ethCollected)
    const sqthCollected = new BigNumber(account.sqthCollected)

    const unrealizedSqthCost = sqthOpenAmount.times(sqthOpenUnitPrice).plus(sqthCloseAmount.times(sqthCloseUnitPrice))
    const unrealizedSqthPnL = sqthOpenAmount.plus(sqthCloseAmount).times(sqthPrice).plus(unrealizedSqthCost)
    const unrealizedEthCost = ethDepositAmount
      .times(ethDepositUnitPrice)
      .minus(ethWithdrawAmount.times(ethWithdrawUnitPrice))
    const unrealizedEthPnL = ethDepositAmount.minus(ethWithdrawAmount).times(ethPrice).minus(unrealizedEthCost)

    const realizedSqthPnL = sqthOpenUnitPrice.plus(sqthCloseUnitPrice).times(sqthCloseAmount)
    const realizedEthPnL = ethWithdrawUnitPrice.minus(ethDepositUnitPrice).times(ethWithdrawAmount)

    const collected = ethCollected.times(ethPrice).plus(sqthCollected.times(sqthPrice))

    const sqthAmount = sqthOpenAmount.plus(sqthCloseAmount)
    const sqthAmountInUSD = sqthAmount.times(sqthPrice)

    console.log(floatifyBigNums({ sqthOpenAmount }))

    return {
      unrealizedPnL: unrealizedSqthPnL.plus(unrealizedEthPnL).plus(collected),
      realizedPnL: realizedSqthPnL.plus(realizedEthPnL).plus(collected),
      sqthAmount,
      sqthAmountInUSD,
    }
  }, [account, ethPrice, sqthPrice])

  return {
    realizedPnL,
    unrealizedPnL,
    sqthAmount,
    sqthAmountInUSD,
    loading: loadingAccount || loadingPrices,
  }
}

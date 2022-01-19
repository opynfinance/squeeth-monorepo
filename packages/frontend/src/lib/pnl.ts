import BigNumber from 'bignumber.js'

import { TransactionType } from '@constants/enums'
import { PositionType } from '../types'

interface Deposit {
  squeethAmount: BigNumber
  ethAmount: BigNumber
  usdValue: BigNumber
  timestamp: string
  transactionType: TransactionType
  txId: string
  ethPriceAtDeposit: BigNumber
}

interface ShortDeposit extends Deposit {
  buyQuote: BigNumber
}

interface GetCurrentShortParams {
  positionType: string
  squeethAmount: BigNumber
  transactions: any[]
  getBuyQuote: (input: BigNumber) => Promise<Record<string, any>>
}

export function getCurrentShortDeposits({ positionType, squeethAmount, transactions }: GetCurrentShortParams) {
  if (positionType === PositionType.LONG) return []
  let totalShortSqth = new BigNumber(0)

  const result: ShortDeposit[] = []
  // let buyQuote
  for (let index = 0; index < transactions.length; index++) {
    if (totalShortSqth.gte(squeethAmount)) break
    if (
      totalShortSqth.isLessThan(squeethAmount) &&
      transactions[index].transactionType === TransactionType.MINT_SHORT
    ) {
      totalShortSqth = totalShortSqth.plus(transactions[index].squeethAmount)
      // buyQuote = await getBuyQuote(transactions[index].squeethAmount)
      result.push(transactions[index])
    } else if (
      totalShortSqth.isLessThan(squeethAmount) &&
      transactions[index].transactionType === TransactionType.BURN_SHORT
    ) {
      totalShortSqth = totalShortSqth.minus(transactions[index].squeethAmount)
    }
  }

  return result
}

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

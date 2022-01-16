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

interface LongDeposit extends Deposit {
  sellQuote: BigNumber
}

interface GetCurrentLongParams {
  positionType: string
  squeethAmount: BigNumber
  transactions: any[]
  getSellQuote: (input: BigNumber) => Promise<Record<string, any>>
}

export async function getCurrentLong({
  getSellQuote,
  positionType,
  squeethAmount,
  transactions,
}: GetCurrentLongParams) {
  if (positionType === PositionType.SHORT) return []
  let totalLongSqth = new BigNumber(0)

  const result: LongDeposit[] = []
  let sellQuote
  for (let index = 0; index < transactions.length; index++) {
    if (totalLongSqth.gte(squeethAmount)) break
    if (totalLongSqth.isLessThan(squeethAmount) && transactions[index].transactionType === TransactionType.BUY) {
      totalLongSqth = totalLongSqth.plus(transactions[index].squeethAmount)
      sellQuote = await getSellQuote(transactions[index].squeethAmount)
      result.push({ ...transactions[index], sellQuote: sellQuote.amountOut })
    } else if (
      totalLongSqth.isLessThan(squeethAmount) &&
      transactions[index].transactionType === TransactionType.SELL
    ) {
      totalLongSqth = totalLongSqth.minus(transactions[index].squeethAmount)
    }
  }

  return result
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

export async function getCurrentShortDeposits({
  getBuyQuote,
  positionType,
  squeethAmount,
  transactions,
}: GetCurrentShortParams) {
  if (positionType === PositionType.LONG) return []
  let totalShortSqth = new BigNumber(0)

  const result: ShortDeposit[] = []
  let buyQuote
  for (let index = 0; index < transactions.length; index++) {
    if (totalShortSqth.gte(squeethAmount)) break
    if (
      totalShortSqth.isLessThan(squeethAmount) &&
      transactions[index].transactionType === TransactionType.MINT_SHORT
    ) {
      totalShortSqth = totalShortSqth.plus(transactions[index].squeethAmount)
      buyQuote = await getBuyQuote(transactions[index].squeethAmount)
      result.push({ ...transactions[index], buyQuote: buyQuote.amountIn })
    } else if (
      totalShortSqth.isLessThan(squeethAmount) &&
      transactions[index].transactionType === TransactionType.BURN_SHORT
    ) {
      totalShortSqth = totalShortSqth.minus(transactions[index].squeethAmount)
    }
  }

  return result
}

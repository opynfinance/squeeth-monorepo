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

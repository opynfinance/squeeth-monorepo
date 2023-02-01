import BigNumber from 'bignumber.js'

export interface OngoingTransaction {
  amount: BigNumber
  queuedTransaction: boolean
}

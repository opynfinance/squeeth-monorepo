import BigNumber from 'bignumber.js'

export enum BullTradeType {
  Deposit = 'Deposit',
  Withdraw = 'Withdraw',
}

export enum BullTradeTransactionType {
  Instant = 'Instant',
  Queued = 'Queued',
}

export interface OngoingTransaction {
  amount: BigNumber
  queuedTransaction: boolean
}

export interface BullTransactionConfirmation {
  status: boolean
  amount: BigNumber
  tradeType: BullTradeType
  transactionType: BullTradeTransactionType
  txId?: string
}

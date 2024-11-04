import BigNumber from 'bignumber.js'

export enum CrabTradeType {
  Deposit = 'Deposit',
  Withdraw = 'Withdraw',
  Redeem = 'Redeem',
}

export enum CrabTradeTransactionType {
  Instant = 'Instant',
  Queued = 'Queued',
}

export interface CrabTransactionConfirmation {
  status: boolean
  amount: BigNumber
  tradeType: CrabTradeType
  transactionType: CrabTradeTransactionType
  token: 'USDC' | 'ETH'
  id?: string
}

export interface OngoingTransaction {
  amount: BigNumber
  queuedTransaction: boolean
  token: 'ETH' | 'USDC'
  analytics?: string[]
}

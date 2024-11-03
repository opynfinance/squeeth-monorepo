import BigNumber from 'bignumber.js'
import React, { useCallback, useState } from 'react'
import { useAtomValue } from 'jotai'

import { PrimaryButtonNew } from '@components/Button'
import Confirmed, { ConfirmType } from '@components/Trade/Confirmed'
import { useTransactionStatus } from '@state/wallet/hooks'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import { addressesAtom } from '@state/positions/atoms'
import { ShutdownEmergencyWithdraw } from './ShutdownEmergencyWithdraw'

export enum BullTradeType {
  Deposit = 'Deposit',
  Withdraw = 'Withdraw',
  Redeem = 'Redeem',
}

export interface BullTransactionConfirmation {
  status: boolean
  amount: BigNumber
  tradeType: BullTradeType
  txId?: string
}

const BullTrade: React.FC = () => {
  const [confirmedTransactionData, setConfirmedTransactionData] = useState<BullTransactionConfirmation | undefined>()

  const { confirmed, transactionData, resetTransactionData } = useTransactionStatus()
  const { bullStrategy } = useAtomValue(addressesAtom)
  const {
    value: bullBalance,
    loading: isBullBalanceLoading,
    refetch: refetchBullBalance,
  } = useTokenBalance(bullStrategy, 30, 18)

  const onTxnConfirm = useCallback(
    (data: BullTransactionConfirmation | undefined) => {
      console.log('Tx on confirm', data, transactionData?.hash)
      setConfirmedTransactionData(data)
      refetchBullBalance()
    },
    [transactionData?.hash, refetchBullBalance],
  )

  const onClose = useCallback(() => {
    setConfirmedTransactionData(undefined)
    resetTransactionData()
  }, [setConfirmedTransactionData, resetTransactionData])

  const getConfirmationMessage = (data?: BullTransactionConfirmation) => {
    if (!data) return ''

    switch (data.tradeType) {
      case BullTradeType.Deposit:
        return `Deposited ${data.amount.toFixed(4)} ETH`
      case BullTradeType.Withdraw:
        return `Withdrawn ${data.amount.toFixed(4)} ETH`
      case BullTradeType.Redeem:
        return `Redeemed ZenBull for ${data.amount.toFixed(4)} WETH`
      default:
        return ''
    }
  }

  return (
    <>
      {confirmed && confirmedTransactionData?.status ? (
        <>
          <Confirmed
            confirmationMessage={getConfirmationMessage(confirmedTransactionData)}
            txnHash={transactionData?.hash ?? ''}
            confirmType={ConfirmType.BULL}
          />
          <PrimaryButtonNew fullWidth id="bull-close-btn" variant="contained" onClick={onClose}>
            Close
          </PrimaryButtonNew>
        </>
      ) : (
        <ShutdownEmergencyWithdraw
          onTxnConfirm={onTxnConfirm}
          isLoadingBalance={isBullBalanceLoading}
          bullBalance={bullBalance}
        />
      )}
    </>
  )
}

export default BullTrade

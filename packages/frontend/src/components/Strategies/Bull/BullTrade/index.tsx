import BigNumber from 'bignumber.js'
import React, { useCallback, useState, useEffect } from 'react'
import { useAtomValue } from 'jotai'

import { PrimaryButtonNew } from '@components/Button'
import Confirmed, { ConfirmType } from '@components/Trade/Confirmed'
import { useTransactionStatus, useDisconnectWallet } from '@state/wallet/hooks'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import { addressesAtom } from '@state/positions/atoms'
import BullEmergencyWithdraw from './EmergencyWithdraw'

export enum BullTradeType {
  Deposit = 'Deposit',
  Withdraw = 'Withdraw',
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
  const disconnectWallet = useDisconnectWallet()
  const { bullStrategy } = useAtomValue(addressesAtom)
  const {
    value: bullBalance,
    loading: isBullBalanceLoading,
    refetch: refetchBullBalance,
  } = useTokenBalance(bullStrategy, 30, 18)

  useEffect(() => {
    // make sure user has specifically connected the wallet to zenbull
    const hasConnectedToZenbullBefore = window.localStorage.getItem('walletConnectedToZenbull') === 'true'
    if (!hasConnectedToZenbullBefore) {
      disconnectWallet()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  return (
    <>
      {confirmed && confirmedTransactionData?.status ? (
        <>
          <Confirmed
            confirmationMessage={`${
              confirmedTransactionData?.tradeType === BullTradeType.Deposit ? `Deposited` : `Withdrawn`
            } ${confirmedTransactionData?.amount.toFixed(4)} ETH`}
            txnHash={transactionData?.hash ?? ''}
            confirmType={ConfirmType.BULL}
          />
          <PrimaryButtonNew fullWidth id="bull-close-btn" variant="contained" onClick={onClose}>
            Close
          </PrimaryButtonNew>
        </>
      ) : (
        <BullEmergencyWithdraw
          onTxnConfirm={onTxnConfirm}
          isLoadingBalance={isBullBalanceLoading}
          bullBalance={bullBalance}
        />
      )}
    </>
  )
}

export default BullTrade

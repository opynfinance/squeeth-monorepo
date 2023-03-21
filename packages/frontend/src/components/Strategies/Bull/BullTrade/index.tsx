import BigNumber from 'bignumber.js'
import React, { useCallback, useState, useEffect } from 'react'
import { useAtomValue } from 'jotai'
import { addressAtom } from '@state/wallet/atoms'

import { PrimaryButtonNew } from '@components/Button'
import Confirmed, { ConfirmType } from '@components/Trade/Confirmed'
import { useBullPosition } from '@hooks/useBullPosition'
import { useTransactionStatus, useDisconnectWallet } from '@state/wallet/hooks'
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
  const address = useAtomValue(addressAtom)
  const disconnectWallet = useDisconnectWallet()

  const { pollForNewTx } = useBullPosition(address ?? '')

  useEffect(() => {
    const hasConnectedToZenbullBefore = window.localStorage.getItem('walletConnectedToZenbull') === 'true'
    console.log({ hasConnectedToZenbullBefore })
    if (!hasConnectedToZenbullBefore) {
      disconnectWallet()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onTxnConfirm = useCallback(
    (data: BullTransactionConfirmation | undefined) => {
      console.log('Tx on confirm', data, transactionData?.hash)
      setConfirmedTransactionData(data)
      if (data?.txId) {
        pollForNewTx(data?.txId)
      }
    },
    [pollForNewTx, transactionData?.hash],
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
        <BullEmergencyWithdraw onTxnConfirm={onTxnConfirm} />
      )}
    </>
  )
}

export default BullTrade

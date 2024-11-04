import { Box } from '@material-ui/core'
import React, { useState, useCallback } from 'react'
import { useAtomValue } from 'jotai'

import Withdraw from './Withdraw'
import { useTransactionStatus } from '@state/wallet/hooks'
import Confirmed, { ConfirmType } from '@components/Trade/Confirmed'
import useAppMemo from '@hooks/useAppMemo'
import { PrimaryButtonNew } from '@components/Button'
import { CrabTransactionConfirmation, CrabTradeType, CrabTradeTransactionType } from './types'
import { useCrabPositionV2 } from '@hooks/useCrabPosition/useCrabPosition'
import { addressAtom } from '@state/wallet/atoms'
import { addressesAtom } from '@state/positions/atoms'
import BigNumber from 'bignumber.js'

const CrabTradeV2: React.FC<{ refetchCrabTokenBalance: (cb?: (newBalance: BigNumber) => void | undefined) => void }> =
  ({ refetchCrabTokenBalance }) => {
    const address = useAtomValue(addressAtom)
    const [confirmedTransactionData, setConfirmedTransactionData] = useState<CrabTransactionConfirmation | undefined>()
    const { confirmed, resetTransactionData, transactionData } = useTransactionStatus()
    const { pollForNewTx } = useCrabPositionV2(address ?? '')

    const confirmationMessage = useAppMemo(() => {
      if (!confirmedTransactionData?.status) return ``
      if (confirmedTransactionData.tradeType === CrabTradeType.Deposit) {
        return confirmedTransactionData.transactionType === CrabTradeTransactionType.Queued
          ? `Initiated ${confirmedTransactionData.amount.toFixed(4)} ${confirmedTransactionData.token} deposit`
          : `Deposited ${confirmedTransactionData.amount.toFixed(4)} ${confirmedTransactionData.token}`
      }
      if (confirmedTransactionData.tradeType === CrabTradeType.Withdraw) {
        return confirmedTransactionData.transactionType === CrabTradeTransactionType.Queued
          ? `Initiated ${confirmedTransactionData.amount.toFixed(4)} ${confirmedTransactionData.token} withdraw`
          : `Withdrawn ${confirmedTransactionData.amount.toFixed(4)} ${confirmedTransactionData.token}`
      }
      if (confirmedTransactionData.tradeType === CrabTradeType.Redeem) {
        return confirmedTransactionData.transactionType === CrabTradeTransactionType.Queued
          ? `Initiated ${confirmedTransactionData.amount.toFixed(4)} ${confirmedTransactionData.token} redeem`
          : `Redeemed ${confirmedTransactionData.amount.toFixed(4)} ${confirmedTransactionData.token}`
      }
      return ``
    }, [confirmedTransactionData])

    const onClose = useCallback(() => {
      setConfirmedTransactionData(undefined)
      resetTransactionData()
    }, [resetTransactionData, setConfirmedTransactionData])

    const onTxnConfirm = useCallback(
      (confirm?: CrabTransactionConfirmation) => {
        setConfirmedTransactionData(confirm)
        confirm?.id ? pollForNewTx(confirm?.id) : null
        refetchCrabTokenBalance()
      },
      [setConfirmedTransactionData, pollForNewTx, refetchCrabTokenBalance],
    )

    if (confirmed && confirmedTransactionData?.status) {
      return (
        <>
          <Confirmed
            confirmationMessage={confirmationMessage}
            txnHash={transactionData?.hash ?? ''}
            confirmType={ConfirmType.CRAB}
          />
          <PrimaryButtonNew fullWidth id="crab-close-btn" variant="contained" onClick={onClose}>
            Close
          </PrimaryButtonNew>
        </>
      )
    }

    return <Withdraw onTxnConfirm={onTxnConfirm} />
  }

export default CrabTradeV2

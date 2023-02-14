import { createStyles, makeStyles } from '@material-ui/core/styles'
import React, { useCallback, useState, useMemo } from 'react'
import { useAtomValue } from 'jotai'

import { PrimaryButtonNew } from '@components/Button'
import { SqueethTabsNew, SqueethTabNew } from '@components/Tabs'
import Confirmed, { ConfirmType } from '@components/Trade/Confirmed'
import { useTransactionStatus } from '@state/wallet/hooks'
import { useBullPosition } from '@hooks/useBullPosition'
import { addressAtom } from '@state/wallet/atoms'
import BullDeposit from './Deposit'
import BullWithdraw from './Withdraw'
import { BullTradeType, BullTransactionConfirmation, BullTradeTransactionType } from './types'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(2),
    },
    tradeContainer: {
      display: 'flex',
      flexDirection: 'column',
    },
    tabBackGround: {
      position: 'sticky',
      top: '0',
      zIndex: 20,
    },
    notice: {
      marginTop: theme.spacing(2.5),
      padding: theme.spacing(2),
      border: `1px solid #F3FF6C`,
      borderRadius: theme.spacing(1),
      display: 'flex',
      background: 'rgba(243, 255, 108, 0.1)',
      alignItems: 'center',
    },
    infoIcon: {
      marginRight: theme.spacing(2),
      color: '#F3FF6C',
    },
    subtitle: {
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    infoText: {
      fontWeight: 500,
      fontSize: '13px',
    },
    slippageContainer: {
      [theme.breakpoints.down('xs')]: {
        flexWrap: 'wrap',
      },
    },
  }),
)

const TxConfirmation: React.FC<{ txnData: BullTransactionConfirmation; txnHash: string; onClose: () => void }> = ({
  txnData,
  txnHash,
  onClose,
}) => {
  const isDepositTx = txnData?.tradeType === BullTradeType.Deposit
  const isQueuedTx = txnData?.transactionType === BullTradeTransactionType.Queued

  const txAmount = txnData?.amount
  const formattedTxAmount = txAmount.toFixed(4)

  const confirmationMessage = useMemo(() => {
    if (isDepositTx) {
      if (isQueuedTx) {
        return `Initiated ${formattedTxAmount} ETH deposit`
      } else {
        return `Deposited ${formattedTxAmount} ETH`
      }
    } else {
      if (isQueuedTx) {
        return `Initiated ${formattedTxAmount} ETH withdraw`
      } else {
        return `Withdrawn ${formattedTxAmount} ETH`
      }
    }
  }, [isDepositTx, isQueuedTx, formattedTxAmount])

  return (
    <>
      <Confirmed confirmationMessage={confirmationMessage} txnHash={txnHash} confirmType={ConfirmType.BULL} />
      <PrimaryButtonNew fullWidth id="bull-close-btn" variant="contained" onClick={onClose}>
        Close
      </PrimaryButtonNew>
    </>
  )
}

const BullTrade: React.FC = () => {
  const [tradeType, setTradeType] = useState(BullTradeType.Deposit)
  const isDeposit = tradeType === BullTradeType.Deposit
  const tabValue = tradeType === BullTradeType.Deposit ? 0 : 1
  const [confirmedTransactionData, setConfirmedTransactionData] = useState<BullTransactionConfirmation | undefined>()
  const { confirmed, transactionData, resetTransactionData } = useTransactionStatus()
  const address = useAtomValue(addressAtom)

  const { pollForNewTx } = useBullPosition(address ?? '')

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

  const classes = useStyles()

  return (
    <>
      {confirmed && confirmedTransactionData?.status ? (
        <TxConfirmation txnData={confirmedTransactionData} txnHash={transactionData?.hash ?? ''} onClose={onClose} />
      ) : (
        <>
          <SqueethTabsNew
            value={tabValue}
            onChange={(_, val) => setTradeType(val === 0 ? BullTradeType.Deposit : BullTradeType.Withdraw)}
            aria-label="bull trade tabs"
            centered
            variant="fullWidth"
            className={classes.tabBackGround}
          >
            <SqueethTabNew id="bull-deposit-tab" label="Deposit" />
            <SqueethTabNew id="bull-withdraw-tab" label="Withdraw" />
          </SqueethTabsNew>
          {isDeposit ? <BullDeposit onTxnConfirm={onTxnConfirm} /> : <BullWithdraw onTxnConfirm={onTxnConfirm} />}
        </>
      )}
    </>
  )
}

export default BullTrade

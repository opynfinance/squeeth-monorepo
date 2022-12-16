import { createStyles, makeStyles } from '@material-ui/core/styles'
import BigNumber from 'bignumber.js'
import React, { useState } from 'react'

import { PrimaryButtonNew } from '@components/Button'
import { SqueethTabsNew, SqueethTabNew } from '@components/Tabs'
import Confirmed, { ConfirmType } from '@components/Trade/Confirmed'
import { useTransactionStatus } from '@state/wallet/hooks'
import BullDeposit from './Deposit'
import BullWithdraw from './Withdraw'

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

type BullTrade = {
  maxCap: BigNumber
  depositedAmount: BigNumber
}

export enum BullTradeType {
  Deposit = 'Deposit',
  Withdraw = 'Withdraw',
}

export interface BullTransactionConfirmation {
  status: boolean
  amount: BigNumber
  tradeType: BullTradeType
}

const BullTrade: React.FC<BullTrade> = ({ maxCap, depositedAmount }) => {
  const [tradeType, setTradeType] = useState(BullTradeType.Deposit)
  const isDeposit = tradeType === BullTradeType.Deposit
  const tabValue = tradeType === BullTradeType.Deposit ? 0 : 1
  const [confirmedTransactionData, setConfirmedTransactionData] = useState<BullTransactionConfirmation | undefined>()
  const { confirmed, transactionData, resetTransactionData } = useTransactionStatus()

  const classes = useStyles()

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
          <PrimaryButtonNew fullWidth id="bull-close-btn" variant="contained" onClick={resetTransactionData}>
            Close
          </PrimaryButtonNew>
        </>
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
          {isDeposit ? (
            <BullDeposit onTxnConfirm={setConfirmedTransactionData} />
          ) : (
            <BullWithdraw onTxnConfirm={setConfirmedTransactionData} />
          )}
        </>
      )}
    </>
  )
}

export default BullTrade

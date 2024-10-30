import { Box, CircularProgress, Typography, Stepper, Step, StepLabel, Collapse } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useAtomValue } from 'jotai'

import { PrimaryButtonNew } from '@components/Button'
import { InputToken } from '@components/InputNew'
import Metric from '@components/Metric'
import { connectedWalletAtom, supportedNetworkAtom } from '@state/wallet/atoms'
import { useTransactionStatus, useSelectWallet } from '@state/wallet/hooks'
import {
  useSetStrategyDataV2,
  useCalculateEthToReceiveShutdown,
  useClaimV2Shares,
  useWithdrawShutdownV2,
} from '@state/crab/hooks'
import { addressesAtom } from '@state/positions/atoms'
import { userMigratedSharesAtom } from '@state/crabMigration/atom'
import { useUpdateSharesData } from '@state/crabMigration/hooks'
import { useUserAllowance } from '@hooks/contracts/useAllowance'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import { formatNumber } from '@utils/formatter'
import { useStyles } from './styles'
import { CrabTradeTransactionType, CrabTradeType, CrabTransactionConfirmation, OngoingTransaction } from './types'
import { CRAB_EVENTS } from '@utils/amplitude'
import useAmplitude from '@hooks/useAmplitude'
import Alert from '@components/Alert'

enum RedeemSteps {
  CLAIM = 'Claim CRAB',
  APPROVE = 'Approve CRAB',
  REDEEM = 'Redeem ETH',
}

const CrabWithdraw: React.FC<{ onTxnConfirm: (txn: CrabTransactionConfirmation) => void }> = ({ onTxnConfirm }) => {
  const classes = useStyles()

  const [currentStep, setCurrentStep] = useState<RedeemSteps>(RedeemSteps.CLAIM)
  const [txLoading, setTxLoading] = useState(false)
  const [ethToReceive, setEthToReceive] = useState(new BigNumber(0))

  const ongoingTransaction = useRef<OngoingTransaction | undefined>()

  const connected = useAtomValue(connectedWalletAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)

  const { crabStrategy2 } = useAtomValue(addressesAtom)
  // const currentCrabBalance = useMemo(() => new BigNumber(0), [])
  // const refetchCrabBalance = () => {}
  const { value: currentCrabBalance, refetch: refetchCrabBalance } = useTokenBalance(crabStrategy2, 30, 18)
  const migratedCrabBalance = useAtomValue(userMigratedSharesAtom)
  const { resetTransactionData } = useTransactionStatus()
  const selectWallet = useSelectWallet()
  const { track } = useAmplitude()

  const claimV2Shares = useClaimV2Shares()
  const calculateEthToReceive = useCalculateEthToReceiveShutdown()
  const withdrawShutdownV2 = useWithdrawShutdownV2()
  const { allowance: crabV2Allowance, approve: approveCrabV2 } = useUserAllowance(crabStrategy2, crabStrategy2)

  console.log({ crabV2Allowance: crabV2Allowance.toString() })

  const updateSharesData = useUpdateSharesData()
  const setStrategyData = useSetStrategyDataV2()

  // Determine initial step based on migrated balance and allowance
  useEffect(() => {
    if (migratedCrabBalance.gt(0)) {
      setCurrentStep(RedeemSteps.CLAIM)
    } else if (crabV2Allowance.lt(currentCrabBalance)) {
      setCurrentStep(RedeemSteps.APPROVE)
    } else {
      setCurrentStep(RedeemSteps.REDEEM)
    }
  }, [migratedCrabBalance, crabV2Allowance, currentCrabBalance])

  // Calculate ETH to receive on component mount
  useEffect(() => {
    const getEthToReceive = async () => {
      const ethAmount = await calculateEthToReceive(currentCrabBalance)
      setEthToReceive(ethAmount || new BigNumber(0))
    }
    getEthToReceive()
  }, [calculateEthToReceive, currentCrabBalance])

  const handleClaimV2Shares = async () => {
    setTxLoading(true)
    try {
      await claimV2Shares()
      setCurrentStep(RedeemSteps.APPROVE)
      track(CRAB_EVENTS.CLAIM_CRABV2_SUCCESS)

      updateSharesData()
      setStrategyData()
      refetchCrabBalance()
    } catch (e) {
      console.error(e)
      track(CRAB_EVENTS.CLAIM_CRABV2_FAILED)
    }
    setTxLoading(false)
  }

  const handleApproveCrabV2 = async () => {
    setTxLoading(true)
    try {
      await approveCrabV2(() => {
        resetTransactionData()
        setCurrentStep(RedeemSteps.REDEEM)
      })
      track(CRAB_EVENTS.APPROVE_CRABV2_SUCCESS)
    } catch (e) {
      console.error(e)
      track(CRAB_EVENTS.APPROVE_CRABV2_FAILED)
    }
    setTxLoading(false)
  }

  const handleRedeemCrabV2 = async () => {
    setTxLoading(true)
    try {
      ongoingTransaction.current = {
        amount: currentCrabBalance,
        token: 'ETH',
        queuedTransaction: false,
        analytics: [CRAB_EVENTS.REDEEM_CRABV2],
      }

      await withdrawShutdownV2(currentCrabBalance, onRedeemTxnConfirmed)
      track(CRAB_EVENTS.REDEEM_CRABV2_SUCCESS)

      setStrategyData()
      refetchCrabBalance()
    } catch (e) {
      console.error(e)
    }
    setTxLoading(false)
  }

  const getActiveStep = () => {
    if (migratedCrabBalance.gt(0)) {
      // If there's migrated balance, count from all three steps
      switch (currentStep) {
        case RedeemSteps.CLAIM:
          return 0
        case RedeemSteps.APPROVE:
          return 1
        case RedeemSteps.REDEEM:
          return 2
        default:
          return 0
      }
    } else {
      // If no migrated balance, count from approve and redeem only
      switch (currentStep) {
        case RedeemSteps.APPROVE:
          return 0
        case RedeemSteps.REDEEM:
          return 1
        default:
          return 0
      }
    }
  }

  const getButtonText = () => {
    if (txLoading) return <CircularProgress color="primary" size="1.5rem" />

    switch (currentStep) {
      case RedeemSteps.CLAIM:
        return 'Claim CRAB'
      case RedeemSteps.APPROVE:
        return 'Approve CRAB'
      case RedeemSteps.REDEEM:
        return 'Redeem ETH'
      default:
        return 'Redeem'
    }
  }

  const handleAction = () => {
    switch (currentStep) {
      case RedeemSteps.CLAIM:
        return handleClaimV2Shares()
      case RedeemSteps.APPROVE:
        return handleApproveCrabV2()
      case RedeemSteps.REDEEM:
        return handleRedeemCrabV2()
    }
  }

  const recordAnalytics = useCallback(
    (events: string[]) => {
      events.forEach((event) => track(event))
    },
    [track],
  )

  const onRedeemTxnConfirmed = useCallback(
    (id?: string) => {
      if (!ongoingTransaction.current) return
      const transaction = ongoingTransaction.current

      onTxnConfirm({
        status: true,
        amount: transaction.amount,
        tradeType: CrabTradeType.Redeem,
        transactionType: CrabTradeTransactionType.Instant,
        token: transaction.token,
        id,
      })
      transaction.analytics ? recordAnalytics(transaction.analytics) : null

      ongoingTransaction.current = undefined
    },
    [onTxnConfirm, recordAnalytics],
  )

  let redeemError: string | undefined

  if (connected) {
    const isApproveOrRedeemStep = currentStep === RedeemSteps.APPROVE || currentStep === RedeemSteps.REDEEM
    if (isApproveOrRedeemStep && currentCrabBalance.lte(0)) {
      redeemError = 'No position to redeem'
    }
  }

  return (
    <>
      <Box display="flex" justifyContent="space-between" alignItems="center" gridGap="12px">
        <Typography variant="h3" className={classes.subtitle}>
          Strategy Redeem
        </Typography>
      </Box>

      <div className={classes.tradeContainer}>
        {/* Show stepper if there's migrated balance OR approval is needed */}
        {(migratedCrabBalance.gt(0) || crabV2Allowance.lt(currentCrabBalance)) && (
          <Stepper activeStep={getActiveStep()} className={classes.stepper}>
            {/* Only show Claim step if there's migrated balance */}
            {migratedCrabBalance.gt(0) ? (
              <Step>
                <StepLabel>Claim CRAB</StepLabel>
              </Step>
            ) : null}

            <Step>
              <StepLabel>Approve CRAB</StepLabel>
            </Step>

            <Step>
              <StepLabel>Redeem ETH</StepLabel>
            </Step>
          </Stepper>
        )}
        <InputToken
          id="crab-redeem-input"
          label="Crab Position"
          value={currentStep === RedeemSteps.CLAIM ? migratedCrabBalance : currentCrabBalance}
          balance={currentStep === RedeemSteps.CLAIM ? migratedCrabBalance : currentCrabBalance}
          symbol="CRAB"
          showMaxAction={false}
          error={!!redeemError}
          helperText={redeemError}
          readOnly={true}
          readOnlyTooltip={
            currentStep === RedeemSteps.CLAIM ? 'Only full claim is allowed' : 'Only full redemption is allowed'
          }
        />

        {(currentStep === RedeemSteps.APPROVE || currentStep === RedeemSteps.REDEEM) && (
          <Box display="flex" alignItems="center" justifyContent="space-between" marginTop="12px">
            <Metric
              label="ETH you will receive"
              value={formatNumber(ethToReceive.toNumber()) + ' ETH'}
              isSmall
              flexDirection="row"
              justifyContent="space-between"
              gridGap="12px"
            />
          </Box>
        )}

        <Collapse in={!!redeemError}>
          <Alert severity="error" marginTop="24px">
            {redeemError}
          </Alert>
        </Collapse>

        <div className={classes.ctaSection}>
          {!connected ? (
            <PrimaryButtonNew
              fullWidth
              variant="contained"
              onClick={selectWallet}
              id="crab-connect-wallet-btn"
              disabled={!!txLoading}
            >
              Connect Wallet
            </PrimaryButtonNew>
          ) : !supportedNetwork ? (
            <PrimaryButtonNew fullWidth variant="contained" disabled={true} id="crab-unsupported-network-btn">
              Unsupported Network
            </PrimaryButtonNew>
          ) : (
            <PrimaryButtonNew
              fullWidth
              id="crab-redeem-btn"
              variant="contained"
              onClick={handleAction}
              disabled={txLoading || !!redeemError}
            >
              {getButtonText()}
            </PrimaryButtonNew>
          )}
        </div>
      </div>
    </>
  )
}

export default CrabWithdraw

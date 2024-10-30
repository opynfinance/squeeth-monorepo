import { Box, CircularProgress, Typography, Stepper, Step, StepLabel, Collapse, Tooltip } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useAtomValue } from 'jotai'

import { PrimaryButtonNew } from '@components/Button'
import { InputToken } from '@components/InputNew'
import Metric from '@components/Metric'
import { connectedWalletAtom, supportedNetworkAtom } from '@state/wallet/atoms'
import { useTransactionStatus, useSelectWallet } from '@state/wallet/hooks'
import {
  useSetStrategyData,
  useSetStrategyDataV2,
  useCalculateEthToReceiveShutdown,
  useClaimV2Shares,
  useWithdrawShutdown,
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
import { SqueethTabsNew, SqueethTabNew } from '@components/Tabs'

enum RedeemStepsV1 {
  APPROVE = 'Approve CRAB',
  REDEEM = 'Redeem ETH',
}

enum RedeemStepsV2 {
  CLAIM = 'Claim CRAB',
  APPROVE = 'Approve CRAB',
  REDEEM = 'Redeem ETH',
}

const CrabWithdraw: React.FC<{ onTxnConfirm: (txn: CrabTransactionConfirmation) => void }> = ({ onTxnConfirm }) => {
  const classes = useStyles()

  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [selectedVersion, setSelectedVersion] = useState<'v1' | 'v2'>('v2')
  const [currentStepV1, setCurrentStepV1] = useState<RedeemStepsV1>(RedeemStepsV1.APPROVE)
  const [currentStepV2, setCurrentStepV2] = useState<RedeemStepsV2>(RedeemStepsV2.CLAIM)
  const [txLoading, setTxLoading] = useState(false)
  const [ethToReceive, setEthToReceive] = useState(new BigNumber(0))

  const ongoingTransaction = useRef<OngoingTransaction | undefined>()

  const connected = useAtomValue(connectedWalletAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)

  const { crabStrategy, crabStrategy2 } = useAtomValue(addressesAtom)
  const { value: currentCrabV1Balance, refetch: refetchCrabV1Balance } = useTokenBalance(crabStrategy, 30, 18)
  const { value: currentCrabV2Balance, refetch: refetchCrabV2Balance } = useTokenBalance(crabStrategy2, 30, 18)
  const { allowance: crabV1Allowance, approve: approveCrabV1 } = useUserAllowance(crabStrategy, crabStrategy)
  const { allowance: crabV2Allowance, approve: approveCrabV2 } = useUserAllowance(crabStrategy2, crabStrategy2)
  const migratedCrabBalance = useAtomValue(userMigratedSharesAtom)

  const { resetTransactionData } = useTransactionStatus()
  const selectWallet = useSelectWallet()
  const { track } = useAmplitude()

  const claimV2Shares = useClaimV2Shares()
  const calculateEthToReceive = useCalculateEthToReceiveShutdown(selectedVersion)
  const withdrawShutdown = useWithdrawShutdown(selectedVersion)

  console.log({ crabV1Allowance: crabV1Allowance.toString(), crabV2Allowance: crabV2Allowance.toString() })

  const updateMigrationSharesData = useUpdateSharesData()
  const setStrategyDataV2 = useSetStrategyDataV2()
  const setStrategyDataV1 = useSetStrategyData()

  useEffect(() => {
    if (selectedVersion === 'v1') {
      if (currentCrabV1Balance && crabV1Allowance) {
        setIsInitialLoading(false)
      }
    } else {
      if (currentCrabV2Balance && crabV2Allowance) {
        setIsInitialLoading(false)
      }
    }
  }, [
    selectedVersion,
    currentCrabV1Balance?.toString(),
    crabV1Allowance?.toString(),
    currentCrabV2Balance?.toString(),
    crabV2Allowance?.toString(),
  ])

  // Determine initial step for V1
  useEffect(() => {
    if (!currentCrabV1Balance || !crabV1Allowance) return

    if (crabV1Allowance.lt(currentCrabV1Balance)) {
      setCurrentStepV1(RedeemStepsV1.APPROVE)
    } else {
      setCurrentStepV1(RedeemStepsV1.REDEEM)
    }
  }, [currentCrabV1Balance?.toString(), crabV1Allowance?.toString()])

  // Determine initial step based on migrated balance and allowance
  useEffect(() => {
    if (!currentCrabV2Balance || !crabV2Allowance) return

    if (migratedCrabBalance.gt(0)) {
      setCurrentStepV2(RedeemStepsV2.CLAIM)
    } else if (crabV2Allowance.lt(currentCrabV2Balance)) {
      setCurrentStepV2(RedeemStepsV2.APPROVE)
    } else {
      setCurrentStepV2(RedeemStepsV2.REDEEM)
    }
  }, [currentCrabV2Balance?.toString(), migratedCrabBalance?.toString(), crabV2Allowance?.toString()])

  // Calculate ETH to receive on component mount
  useEffect(() => {
    let mounted = true

    const getEthToReceive = async () => {
      const balance = selectedVersion === 'v1' ? currentCrabV1Balance : currentCrabV2Balance

      if (balance.eq(0)) {
        if (mounted) {
          setEthToReceive(new BigNumber(0))
        }
        return
      }

      const ethAmount = await calculateEthToReceive(balance)
      if (mounted) {
        setEthToReceive(ethAmount || new BigNumber(0))
      }
    }
    getEthToReceive()

    return () => {
      mounted = false
    }
  }, [selectedVersion, calculateEthToReceive, currentCrabV1Balance?.toString(), currentCrabV2Balance?.toString()])

  const handleClaimV2Shares = async () => {
    setTxLoading(true)
    try {
      await claimV2Shares()
      setCurrentStepV2(RedeemStepsV2.APPROVE)
      track(CRAB_EVENTS.CLAIM_CRABV2_SUCCESS)

      updateMigrationSharesData()
      setStrategyDataV2()
      refetchCrabV2Balance()
    } catch (e) {
      console.error(e)
      track(CRAB_EVENTS.CLAIM_CRABV2_FAILED)
    }
    setTxLoading(false)
  }

  const handleApproveCrabV1 = async () => {
    setTxLoading(true)
    try {
      await approveCrabV1(() => {
        resetTransactionData()
        setCurrentStepV1(RedeemStepsV1.REDEEM)
      })
      track(CRAB_EVENTS.APPROVE_CRABV1_SUCCESS)
    } catch (e) {
      console.error(e)
      track(CRAB_EVENTS.APPROVE_CRABV1_FAILED)
    }
    setTxLoading(false)
  }

  const handleApproveCrabV2 = async () => {
    setTxLoading(true)
    try {
      await approveCrabV2(() => {
        resetTransactionData()
        setCurrentStepV2(RedeemStepsV2.REDEEM)
      })
      track(CRAB_EVENTS.APPROVE_CRABV2_SUCCESS)
    } catch (e) {
      console.error(e)
      track(CRAB_EVENTS.APPROVE_CRABV2_FAILED)
    }
    setTxLoading(false)
  }

  const handleRedeemCrabV1 = async () => {
    setTxLoading(true)
    try {
      ongoingTransaction.current = {
        amount: currentCrabV1Balance,
        token: 'ETH',
        queuedTransaction: false,
        analytics: [CRAB_EVENTS.REDEEM_CRABV1],
      }

      await withdrawShutdown(currentCrabV1Balance, onRedeemTxnConfirmed)
      track(CRAB_EVENTS.REDEEM_CRABV1_SUCCESS)

      setStrategyDataV1()
      refetchCrabV1Balance()
    } catch (e) {
      console.error(e)
      track(CRAB_EVENTS.REDEEM_CRABV1_FAILED)
    }
    setTxLoading(false)
  }

  const handleRedeemCrabV2 = async () => {
    setTxLoading(true)
    try {
      ongoingTransaction.current = {
        amount: currentCrabV2Balance,
        token: 'ETH',
        queuedTransaction: false,
        analytics: [CRAB_EVENTS.REDEEM_CRABV2],
      }

      await withdrawShutdown(currentCrabV2Balance, onRedeemTxnConfirmed)
      track(CRAB_EVENTS.REDEEM_CRABV2_SUCCESS)

      setStrategyDataV2()
      refetchCrabV2Balance()
    } catch (e) {
      console.error(e)
      track(CRAB_EVENTS.REDEEM_CRABV2_FAILED)
    }
    setTxLoading(false)
  }

  const buttonText = useMemo(() => {
    if (isInitialLoading || txLoading) return <CircularProgress color="primary" size="1.5rem" />

    if (selectedVersion === 'v1') {
      switch (currentStepV1) {
        case RedeemStepsV1.APPROVE:
          return 'Approve CRAB'
        case RedeemStepsV1.REDEEM:
          return 'Redeem ETH'
        default:
          return 'Redeem'
      }
    } else {
      switch (currentStepV2) {
        case RedeemStepsV2.CLAIM:
          return 'Claim CRAB'
        case RedeemStepsV2.APPROVE:
          return 'Approve CRAB'
        case RedeemStepsV2.REDEEM:
          return 'Redeem ETH'
        default:
          return 'Redeem'
      }
    }
  }, [isInitialLoading, txLoading, currentStepV1, currentStepV2, selectedVersion])

  const handleAction = () => {
    if (selectedVersion === 'v1') {
      switch (currentStepV1) {
        case RedeemStepsV1.APPROVE:
          return handleApproveCrabV1()
        case RedeemStepsV1.REDEEM:
          return handleRedeemCrabV1()
      }
    } else {
      switch (currentStepV2) {
        case RedeemStepsV2.CLAIM:
          return handleClaimV2Shares()
        case RedeemStepsV2.APPROVE:
          return handleApproveCrabV2()
        case RedeemStepsV2.REDEEM:
          return handleRedeemCrabV2()
      }
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

  // Memoize error state
  const redeemError = useMemo(() => {
    if (!connected) return undefined

    if (selectedVersion === 'v1') {
      if (currentCrabV1Balance.lte(0)) {
        return 'No V1 position to redeem'
      }
    } else {
      const isApproveOrRedeemStep = currentStepV2 === RedeemStepsV2.APPROVE || currentStepV2 === RedeemStepsV2.REDEEM
      if (isApproveOrRedeemStep && currentCrabV2Balance.lte(0)) {
        return 'No position to redeem'
      }
    }
    return undefined
  }, [connected, selectedVersion, currentCrabV1Balance?.toString(), currentStepV2, currentCrabV2Balance?.toString()])

  return (
    <>
      <Box display="flex" justifyContent="space-between" alignItems="center" gridGap="12px">
        <Typography variant="h3" className={classes.subtitle}>
          Strategy Redeem
        </Typography>
      </Box>

      <div className={classes.tradeContainer}>
        {currentCrabV1Balance.gt(0) && (
          <SqueethTabsNew
            value={selectedVersion}
            onChange={(_, newValue) => setSelectedVersion(newValue)}
            aria-label="crab-version-tab"
            centered
            variant="fullWidth"
            style={{ marginBottom: '1rem' }}
          >
            <SqueethTabNew label="Crab V1" value="v1" />
            <SqueethTabNew label="Crab V2" value="v2" />
          </SqueethTabsNew>
        )}

        {selectedVersion === 'v2' ? (
          <RedeemStepperV2
            migratedCrabBalance={migratedCrabBalance}
            currentCrabV2Balance={currentCrabV2Balance}
            crabV2Allowance={crabV2Allowance}
            currentStepV2={currentStepV2}
          />
        ) : (
          <RedeemStepperV1
            currentCrabV1Balance={currentCrabV1Balance}
            crabV1Allowance={crabV1Allowance}
            currentStep={currentStepV1}
          />
        )}

        <InputToken
          id="crab-redeem-input"
          label="Crab Position"
          value={
            selectedVersion === 'v1'
              ? currentCrabV1Balance
              : currentStepV2 === RedeemStepsV2.CLAIM
              ? migratedCrabBalance
              : currentCrabV2Balance
          }
          balance={
            selectedVersion === 'v1'
              ? currentCrabV1Balance
              : currentStepV2 === RedeemStepsV2.CLAIM
              ? migratedCrabBalance
              : currentCrabV2Balance
          }
          symbol="CRAB"
          showMaxAction={false}
          error={!!redeemError}
          helperText={redeemError}
          readOnly={true}
          readOnlyTooltip="Only full redemption is allowed"
        />

        {/* Show ETH to receive for both V1 and V2 */}
        {(selectedVersion === 'v1' ||
          (selectedVersion === 'v2' &&
            (currentStepV2 === RedeemStepsV2.APPROVE || currentStepV2 === RedeemStepsV2.REDEEM))) && (
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
              {buttonText}
            </PrimaryButtonNew>
          )}
        </div>
      </div>
    </>
  )
}

const RedeemStepperV1: React.FC<{
  currentCrabV1Balance: BigNumber
  crabV1Allowance: BigNumber
  currentStep: RedeemStepsV1
}> = ({ currentCrabV1Balance, crabV1Allowance, currentStep }) => {
  const classes = useStyles()

  // Only show stepper if approval is needed
  if (!crabV1Allowance.lt(currentCrabV1Balance)) {
    return null
  }

  return (
    <Stepper activeStep={currentStep === RedeemStepsV1.APPROVE ? 0 : 1} className={classes.stepper}>
      <Step key="approve">
        <StepLabel>
          <Tooltip title="Approve CrabV1 strategy to spend your CrabV1 tokens" placement="top">
            <Typography>Approve CRAB</Typography>
          </Tooltip>
        </StepLabel>
      </Step>
      <Step key="redeem">
        <StepLabel>
          <Tooltip title="Redeem CrabV1 tokens to get ETH" placement="top">
            <Typography>Redeem ETH</Typography>
          </Tooltip>
        </StepLabel>
      </Step>
    </Stepper>
  )
}

const RedeemStepperV2: React.FC<{
  migratedCrabBalance: BigNumber
  currentCrabV2Balance: BigNumber
  crabV2Allowance: BigNumber
  currentStepV2: RedeemStepsV2
}> = ({ migratedCrabBalance, currentCrabV2Balance, crabV2Allowance, currentStepV2 }) => {
  const classes = useStyles()

  // Only show stepper if there's migrated balance OR approval is needed
  if (!migratedCrabBalance.gt(0) && !crabV2Allowance.lt(currentCrabV2Balance)) {
    return null
  }

  const getActiveStep = () => {
    if (migratedCrabBalance.gt(0)) {
      // If there's migrated balance, count from all three steps
      switch (currentStepV2) {
        case RedeemStepsV2.CLAIM:
          return 0
        case RedeemStepsV2.APPROVE:
          return 1
        case RedeemStepsV2.REDEEM:
          return 2
        default:
          return 0
      }
    } else {
      // If no migrated balance, count from approve and redeem only
      switch (currentStepV2) {
        case RedeemStepsV2.APPROVE:
          return 0
        case RedeemStepsV2.REDEEM:
          return 1
        default:
          return 0
      }
    }
  }

  return (
    <Stepper activeStep={getActiveStep()} className={classes.stepper}>
      {/* Only show Claim step if there's migrated balance */}
      {migratedCrabBalance.gt(0) && (
        <Step key="claim">
          <StepLabel>
            <Tooltip title="Claim CrabV2 tokens from CrabMigration contract" placement="top">
              <Typography>Claim CRAB</Typography>
            </Tooltip>
          </StepLabel>
        </Step>
      )}
      <Step key="approve">
        <StepLabel>
          <Tooltip title="Approve CrabV2 strategy to spend your CrabV2 tokens" placement="top">
            <Typography>Approve CRAB</Typography>
          </Tooltip>
        </StepLabel>
      </Step>
      <Step key="redeem">
        <StepLabel>
          <Tooltip title="Redeem CrabV2 tokens to get ETH" placement="top">
            <Typography>Redeem ETH</Typography>
          </Tooltip>
        </StepLabel>
      </Step>
    </Stepper>
  )
}

export default CrabWithdraw

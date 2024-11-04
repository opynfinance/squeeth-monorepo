import React, { useState, useEffect } from 'react'
import { Box, Typography, CircularProgress, Collapse } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import { useAtomValue } from 'jotai'
import InfoIcon from '@material-ui/icons/Info'

import { PrimaryButtonNew } from '@components/Button'
import { InputToken } from '@components/InputNew'
import Metric from '@components/Metric'
import Alert from '@components/Alert'
import { useUserAllowance } from '@hooks/contracts/useAllowance'
import { addressesAtom } from '@state/positions/atoms'
import { connectedWalletAtom, supportedNetworkAtom } from '@state/wallet/atoms'
import { useSelectWallet } from '@state/wallet/hooks'
import useTrackTransactionFlow from '@hooks/useTrackTransactionFlow'
import { formatNumber } from '@utils/formatter'
import { BULL_EVENTS } from '@utils/amplitude'
import { BIG_ZERO } from '@constants/index'
import { useZenBullStyles } from './styles'
import { BullTradeType, BullTransactionConfirmation } from './index'
import { useBullShutdownEmergencyWithdrawState, useZenBullRedeem, useCalculateWethToReceive } from '@state/bull/hooks'
import { useRestrictUser } from '@context/restrict-user'
import RestrictionInfo from '@components/RestrictionInfo'

type Callback = () => void

interface ShutdownEmergencyWithdrawProps {
  onTxnConfirm: (txn: BullTransactionConfirmation) => void
  isLoadingBalance: boolean
  bullBalance: BigNumber
  refetchBullBalance: (cb?: Callback) => void
}

export const ShutdownEmergencyWithdraw: React.FC<ShutdownEmergencyWithdrawProps> = ({
  onTxnConfirm,
  isLoadingBalance,
  bullBalance,
  refetchBullBalance,
}) => {
  const classes = useZenBullStyles()
  const [isRedeemTxnLoading, setIsRedeemTxnLoading] = useState(false)
  const [hasJustApprovedZenBull, setHasJustApprovedZenBull] = useState(false)
  const [isWethToReceiveLoading, setIsWethToReceiveLoading] = useState(false)
  const [estimatedWethToReceive, setEstimatedWethToReceive] = useState(BIG_ZERO)

  // Contract state & recovery hooks
  const { bullStrategy, bullShutdownEmergencyWithdraw } = useAtomValue(addressesAtom)
  const { isContractReadyForRedemption } = useBullShutdownEmergencyWithdrawState()

  const calculateWethToReceive = useCalculateWethToReceive(bullBalance)
  const redeemZenBull = useZenBullRedeem()

  // Common hooks
  const connected = useAtomValue(connectedWalletAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const selectWallet = useSelectWallet()
  const { allowance: zenBullAllowance, approve: approveZenBull } = useUserAllowance(
    bullStrategy,
    bullShutdownEmergencyWithdraw,
  )

  const { isRestricted, isWithdrawAllowed } = useRestrictUser()

  const logAndRunTransaction = useTrackTransactionFlow()

  // Update estimated WETH on balance changes with loading state
  useEffect(() => {
    let mounted = true

    const updateEstimate = async () => {
      if (!bullBalance.isZero()) {
        setIsWethToReceiveLoading(true)
        try {
          const wethAmount = await calculateWethToReceive()
          if (mounted) {
            setEstimatedWethToReceive(wethAmount)
          }
        } catch (error) {
          console.error('Error calculating WETH to receive:', error)
        } finally {
          if (mounted) {
            setIsWethToReceiveLoading(false)
          }
        }
      } else {
        if (mounted) {
          setEstimatedWethToReceive(BIG_ZERO)
          setIsWethToReceiveLoading(false)
        }
      }
    }

    updateEstimate()

    return () => {
      mounted = false
    }
  }, [bullBalance?.toString(), calculateWethToReceive])

  const onApproveClick = async () => {
    setIsRedeemTxnLoading(true)
    try {
      await logAndRunTransaction(async () => {
        await approveZenBull(() => {
          setHasJustApprovedZenBull(true)
          console.log('Approved ZenBull')
        })
      }, BULL_EVENTS.APPROVE_ZENBULL_REDEMPTION)
    } catch (e) {
      console.error(e)
    }
    setIsRedeemTxnLoading(false)
  }

  const onRedeemClick = async () => {
    setIsRedeemTxnLoading(true)
    try {
      await redeemZenBull(bullBalance, (wethReceived) => {
        onTxnConfirm({
          status: true,
          amount: wethReceived,
          tradeType: BullTradeType.Redeem,
        })

        refetchBullBalance()
      })
    } catch (e) {
      console.error(e)
    }
    setIsRedeemTxnLoading(false)
  }

  // Check for redemption errors
  const [isShutdownRedemptionContractActive, setIsShutdownRedemptionContractActive] = useState(false)
  useEffect(() => {
    const checkEmergency = async () => {
      const active = await isContractReadyForRedemption()
      setIsShutdownRedemptionContractActive(active)
    }
    checkEmergency()
  }, [isContractReadyForRedemption])

  const redeemError = !isShutdownRedemptionContractActive
    ? 'Shutdown redemption contract not ready'
    : !isLoadingBalance && bullBalance.lte(0)
    ? 'No ZenBull to redeem'
    : undefined

  const needsApproval = zenBullAllowance.lt(bullBalance) && !hasJustApprovedZenBull

  return (
    <>
      <Typography variant="h3" className={classes.subtitle} style={{ marginTop: '16px' }}>
        Shutdown Redemption
      </Typography>

      <Typography variant="body2" style={{ marginTop: '8px', marginBottom: '24px' }}>
        Redeem ZenBull tokens for WETH after protocol shutdown
      </Typography>

      <div className={classes.tradeContainer}>
        <InputToken
          id="zenbull-redeem-input"
          value={bullBalance.toString()}
          balance={bullBalance}
          symbol="ZenBull"
          isBalanceLoading={isLoadingBalance}
          showMaxAction={false}
          error={!!redeemError}
          helperText={redeemError}
          readOnly={true}
          readOnlyTooltip="Only full redemption is allowed"
        />

        <Box display="flex" justifyContent="space-between" marginTop="24px">
          <Metric
            label="WETH to Receive"
            value={isWethToReceiveLoading ? 'Loading...' : formatNumber(estimatedWethToReceive.toNumber(), 4) + ' WETH'}
            isSmall
            flexDirection="row"
            justifyContent="space-between"
            gridGap="12px"
          />
        </Box>

        <Collapse in={!!redeemError}>
          <Alert severity="error" marginTop="24px">
            {redeemError}
          </Alert>
        </Collapse>

        {isRestricted && <RestrictionInfo withdrawAllowed={isWithdrawAllowed} marginTop="24px" />}

        <Box marginTop="24px">
          {!connected ? (
            <PrimaryButtonNew fullWidth variant="contained" onClick={selectWallet} id="zenbull-connect-wallet-btn">
              Connect Wallet
            </PrimaryButtonNew>
          ) : !supportedNetwork ? (
            <PrimaryButtonNew fullWidth variant="contained" disabled={true} id="zenbull-unsupported-network-btn">
              Unsupported Network
            </PrimaryButtonNew>
          ) : needsApproval ? (
            <PrimaryButtonNew
              fullWidth
              variant="contained"
              onClick={onApproveClick}
              disabled={isRedeemTxnLoading || isWethToReceiveLoading || !!redeemError}
              id="zenbull-approve-btn"
            >
              {!isRedeemTxnLoading ? 'Approve ZenBull' : <CircularProgress color="primary" size="2rem" />}
            </PrimaryButtonNew>
          ) : (
            <PrimaryButtonNew
              fullWidth
              variant="contained"
              onClick={onRedeemClick}
              disabled={isRedeemTxnLoading || isWethToReceiveLoading || !!redeemError}
              id="zenbull-redeem-btn"
            >
              {!isRedeemTxnLoading ? 'Redeem ZenBull' : <CircularProgress color="primary" size="2rem" />}
            </PrimaryButtonNew>
          )}
        </Box>
      </div>
    </>
  )
}

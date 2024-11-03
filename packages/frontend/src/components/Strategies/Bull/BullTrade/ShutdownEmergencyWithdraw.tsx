import React, { useState, useEffect } from 'react'
import { Box, Typography, CircularProgress, Tooltip } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import { useAtomValue } from 'jotai'
import InfoIcon from '@material-ui/icons/Info'

import { PrimaryButtonNew } from '@components/Button'
import { InputToken } from '@components/InputNew'
import Metric from '@components/Metric'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
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

interface ShutdownEmergencyWithdrawProps {
  onTxnConfirm: (txn: BullTransactionConfirmation) => void
  isLoadingBalance: boolean
  bullBalance: BigNumber
}

export const ShutdownEmergencyWithdraw: React.FC<ShutdownEmergencyWithdrawProps> = ({
  onTxnConfirm,
  isLoadingBalance,
  bullBalance,
}) => {
  const classes = useZenBullStyles()
  const [isRedeemTxnLoading, setIsRedeemTxnLoading] = useState(false)
  const [hasJustApprovedZenBull, setHasJustApprovedZenBull] = useState(false)
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

  const logAndRunTransaction = useTrackTransactionFlow()

  // Update estimated WETH on balance changes
  useEffect(() => {
    const updateEstimate = async () => {
      const wethAmount = await calculateWethToReceive()
      setEstimatedWethToReceive(wethAmount)
    }
    updateEstimate()
  }, [bullBalance, calculateWethToReceive])

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
    : bullBalance.lte(0)
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
            value={formatNumber(estimatedWethToReceive.toNumber(), 4) + ' WETH'}
            isSmall
            flexDirection="row"
            justifyContent="space-between"
            gridGap="12px"
          />
        </Box>

        {!isShutdownRedemptionContractActive && (
          <Box marginTop="16px" display="flex" alignItems="center" className={classes.notice}>
            <div className={classes.infoIcon}>
              <Tooltip title="Emergency withdrawal is not yet active">
                <InfoIcon fontSize="medium" />
              </Tooltip>
            </div>
            <Typography variant="caption" className={classes.infoText}>
              Shutdown redemption contract is not yet active
            </Typography>
          </Box>
        )}

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
              disabled={isRedeemTxnLoading || !!redeemError}
              id="zenbull-approve-btn"
            >
              {!isRedeemTxnLoading ? 'Approve ZenBull' : <CircularProgress color="primary" size="2rem" />}
            </PrimaryButtonNew>
          ) : (
            <PrimaryButtonNew
              fullWidth
              variant="contained"
              onClick={onRedeemClick}
              disabled={isRedeemTxnLoading || !!redeemError}
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

import LoadingButton from '@components/Button/LoadingButton'
import { useUserAllowance } from '@hooks/contracts/useAllowance'
import { Box, List, ListItem, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import BigNumber from 'bignumber.js'
import { useAtom, useAtomValue } from 'jotai'
import React from 'react'
import { useEffect } from 'react'
import { useCallback } from 'react'
import { useState } from 'react'
import {
  BUY_AND_LP_STEPS,
  lpBuyStepAtom,
  lpEthAmountAtom,
  lpSqthAmountAtom,
  lpSwapAndAddResultAtom,
} from 'src/state/lp/atoms'
import { addressesAtom } from 'src/state/positions/atoms'
import PreviewItem from './PreviewItem'
import ArrowRightAltIcon from '@material-ui/icons/ArrowRightAlt'
import { useMemo } from 'react'
import useAppCallback from '@hooks/useAppCallback'
import { signerAtom } from 'src/state/wallet/atoms'
import { useHandleSignerTransaction } from 'src/state/wallet/hooks'
import { ethers } from 'ethers'

const useStyles = makeStyles((theme) =>
  createStyles({
    activeStep: {
      color: theme.palette.text.primary,
      fontWeight: 500,
    },
    setp: {
      color: theme.palette.text.secondary,
    },
  }),
)

const SwapAndAdd: React.FC = () => {
  const classes = useStyles()
  const ethAmount = useAtomValue(lpEthAmountAtom)
  const sqthAmount = useAtomValue(lpSqthAmountAtom)
  const { oSqueeth, swapRouter } = useAtomValue(addressesAtom)
  const routeResult = useAtomValue(lpSwapAndAddResultAtom)
  const [currentStep, updateCurrentStep] = useAtom(lpBuyStepAtom)
  const { isApprovalNeeded, approve } = useUserAllowance(oSqueeth, swapRouter, new BigNumber(sqthAmount))
  const signer = useAtomValue(signerAtom)
  const handleSignerTransaction = useHandleSignerTransaction()

  const [txLoading, setTxLoading] = useState(false)

  useEffect(() => {
    if (!isApprovalNeeded) updateCurrentStep(BUY_AND_LP_STEPS.SUBMIT_TX)
  }, [isApprovalNeeded, updateCurrentStep])

  const [swapEth, swapSqth] = useMemo(() => {
    return [routeResult?.result.trade.inputAmount, routeResult?.result.trade.outputAmount]
  }, [routeResult?.result.trade.inputAmount, routeResult?.result.trade.outputAmount])

  const approveOSQTH = useCallback(async () => {
    setTxLoading(true)
    try {
      await approve(() => {
        setTxLoading(false)
      })
    } catch (e) {
      setTxLoading(false)
    }
  }, [approve])

  const addLiquidity = useAppCallback(async () => {
    if (!routeResult?.result) return

    const { result } = routeResult

    const value = ethers.BigNumber.from(result.methodParameters?.value || 0)
    console.log(result.methodParameters?.value)
    console.log(value.toString())

    console.log(result.methodParameters?.calldata)

    if (signer && result.methodParameters?.value) {
      try {
        setTxLoading(true)
        handleSignerTransaction(
          await signer.sendTransaction({
            to: swapRouter!,
            value: value,
            data: result.methodParameters?.calldata,
            gasPrice: result.gasPriceWei,
          }),
          () => {
            setTxLoading(false)
          },
        )
      } catch (e) {
        console.log(e)
        setTxLoading(false)
      }
    }
  }, [handleSignerTransaction, routeResult, signer, swapRouter])

  const executeCurrentStep = useCallback(async () => {
    if (currentStep === BUY_AND_LP_STEPS.APPROVE_OSQTH) approveOSQTH()

    addLiquidity()
  }, [addLiquidity, approveOSQTH, currentStep])

  return (
    <Box>
      <Typography variant="h6" style={{ marginBottom: '4px' }}>
        Swap
      </Typography>
      <Box display="flex" alignItems="center">
        <Typography variant="body2" component="span" style={{ fontWeight: 700 }}>
          {swapEth?.toSignificant(8)}{' '}
        </Typography>
        <Typography style={{ marginLeft: '8px' }} variant="body2" color="textSecondary" component="span">
          {' '}
          ETH
        </Typography>
        <ArrowRightAltIcon style={{ marginLeft: '8px' }} />
        <Typography style={{ fontWeight: 700, marginLeft: '8px' }} variant="body2">
          {swapSqth?.toSignificant(8)}{' '}
        </Typography>
        <Typography style={{ marginLeft: '8px' }} variant="body2" color="textSecondary">
          oSQTH
        </Typography>
      </Box>
      <Typography variant="h6" style={{ marginBottom: '4px', marginTop: '24px' }}>
        Final liquidity
      </Typography>
      <PreviewItem
        title="oSQTH Amount"
        value={new BigNumber(sqthAmount).plus(swapSqth?.toSignificant(18) || 0).toFixed(6)}
      />
      <PreviewItem
        title="ETH Amount"
        value={new BigNumber(ethAmount).minus(swapEth?.toSignificant(18) || 0).toFixed(6)}
      />
      <Typography variant="h6" style={{ marginTop: '24px' }}>
        Steps
      </Typography>
      <List>
        {Object.entries(BUY_AND_LP_STEPS).map(([key, value], i) => (
          <ListItem key={key} style={{ paddingLeft: 0, paddingTop: '0px' }}>
            <Typography variant="body2" className={value === currentStep ? classes.activeStep : classes.setp}>
              {i + 1}) {' ' + value}
            </Typography>
          </ListItem>
        ))}
      </List>
      <Box width="fit-content" margin="auto">
        <LoadingButton isLoading={txLoading} onClick={executeCurrentStep} style={{ margin: 'auto', marginTop: '24px' }}>
          {currentStep}
        </LoadingButton>
      </Box>
    </Box>
  )
}

export default SwapAndAdd

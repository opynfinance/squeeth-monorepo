import { PrimaryButton } from '@components/Button'
import LoadingButton from '@components/Button/LoadingButton'
import { DEFAULT_SLIPPAGE } from '../../../constants'
import { useUserAllowance } from '@hooks/contracts/useAllowance'
import { Box, Grid, List, ListItem, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { getPositionFromAmounts } from '@utils/lpUtils'
import BigNumber from 'bignumber.js'
import { useAtom, useAtomValue } from 'jotai'
import React from 'react'
import { useState } from 'react'
import { useCallback } from 'react'
import { useEffect } from 'react'
import {
  BUY_AND_LP_STEPS,
  lpBuyStepAtom,
  lpEthAmountAtom,
  lpSqthAmountAtom,
  lpTickLower,
  lpTickUpper,
} from 'src/state/lp/atoms'
import { useLPInputValidation } from 'src/state/lp/hooks'
import { addressesAtom, isWethToken0Atom } from 'src/state/positions/atoms'
import { poolAtom } from 'src/state/squeethPool/atoms'
import { parseSlippageInput } from '@utils/calculations'
import { NonfungiblePositionManager } from '@uniswap/v3-sdk'
import { addressAtom, networkIdAtom, signerAtom } from 'src/state/wallet/atoms'
import { Ether } from '@uniswap/sdk-core'
import { useHandleSignerTransaction } from 'src/state/wallet/hooks'
import PreviewItem from './PreviewItem'

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

const AddLiquidity: React.FC = () => {
  const classes = useStyles()
  const sqthAmount = useAtomValue(lpSqthAmountAtom)
  const ethAmount = useAtomValue(lpEthAmountAtom)
  const [currentStep, updateCurrentStep] = useAtom(lpBuyStepAtom)
  const { oSqueeth, nftManager } = useAtomValue(addressesAtom)
  const { isApprovalNeeded, approve } = useUserAllowance(oSqueeth, nftManager, new BigNumber(sqthAmount))
  const squeethPool = useAtomValue(poolAtom)
  const tickLower = useAtomValue(lpTickLower)
  const tickUpper = useAtomValue(lpTickUpper)
  const isWethToken0 = useAtomValue(isWethToken0Atom)
  const address = useAtomValue(addressAtom)
  const network = useAtomValue(networkIdAtom)
  const signer = useAtomValue(signerAtom)
  const handleSignerTransaction = useHandleSignerTransaction()

  const [txLoading, setTxLoading] = useState(false)

  useEffect(() => {
    if (!isApprovalNeeded) updateCurrentStep(BUY_AND_LP_STEPS.SUBMIT_TX)
  }, [isApprovalNeeded, updateCurrentStep])

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

  const addLiquidity = useCallback(async () => {
    const position = getPositionFromAmounts(
      squeethPool!,
      tickLower,
      tickUpper,
      Number(ethAmount),
      Number(sqthAmount),
      isWethToken0,
    )

    const slippageTolerance = parseSlippageInput(DEFAULT_SLIPPAGE.toString())
    const useNative = Ether.onChain(network) // Use ETH as input

    const deadline = +new Date() + 10 * 60 * 1000 // TODO: use current blockchain timestamp

    const { calldata, value } = NonfungiblePositionManager.addCallParameters(position, {
      recipient: address!,
      deadline,
      slippageTolerance,
      useNative,
    })

    console.log(value)
    const tx = {
      to: nftManager,
      data: calldata,
      value,
    }

    if (signer) {
      setTxLoading(true)
      handleSignerTransaction(
        await signer.sendTransaction({
          ...tx,
        }),
        () => {
          setTxLoading(false)
        },
      )
    }
  }, [
    address,
    ethAmount,
    handleSignerTransaction,
    isWethToken0,
    network,
    nftManager,
    signer,
    sqthAmount,
    squeethPool,
    tickLower,
    tickUpper,
  ])

  const executeCurrentStep = useCallback(async () => {
    if (currentStep === BUY_AND_LP_STEPS.APPROVE_OSQTH) approveOSQTH()

    addLiquidity()
  }, [addLiquidity, approveOSQTH, currentStep])

  return (
    <Box>
      <Typography variant="h6" style={{ marginBottom: '8px' }}>
        Preview
      </Typography>
      <PreviewItem title="oSQTH Amount" value={Number(sqthAmount).toFixed(6)} />
      <PreviewItem title="ETH Amount" value={Number(ethAmount).toFixed(6)} />
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

export default AddLiquidity

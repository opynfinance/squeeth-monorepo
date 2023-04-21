import React, { useCallback, useState, useRef, useMemo } from 'react'
import { Box, Typography, Link, CircularProgress, Tooltip, withStyles, IconButton } from '@material-ui/core'
import HelpOutlineIcon from '@material-ui/icons/InfoOutlined'
import InfoIcon from '@material-ui/icons/Info'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { useAtom, useAtomValue } from 'jotai'
import BigNumber from 'bignumber.js'
import debounce from 'lodash/debounce'
import ArrowBackIcon from '@material-ui/icons/ArrowBack'
import ArrowForwardIcon from '@material-ui/icons/ArrowForward'

import { InputToken } from '@components/InputNew'
import Metric from '@components/Metric'
import { TradeSettings } from '@components/TradeSettings'
import { PrimaryButtonNew } from '@components/Button'
import RestrictionInfo from '@components/RestrictionInfo'
import { crabStrategySlippageAtomV2 } from '@state/crab/atoms'
import { indexAtom, impliedVolAtom, normFactorAtom } from '@state/controller/atoms'
import { useSelectWallet } from '@state/wallet/hooks'
import { connectedWalletAtom, supportedNetworkAtom } from '@state/wallet/atoms'
import { addressesAtom } from '@state/positions/atoms'
import { bullCrabPositionValueInEth, bullCrabValueInEth } from '@state/bull/atoms'
import { useGetEmergencyWithdrawParams, useBullEmergencyWithdrawEthFromCrab } from '@state/bull/hooks'
import useAppCallback from '@hooks/useAppCallback'
import { useUserAllowance } from '@hooks/contracts/useAllowance'
import useTrackTransactionFlow from '@hooks/useTrackTransactionFlow'
import useExecuteOnce from '@hooks/useExecuteOnce'
import useAmplitude from '@hooks/useAmplitude'
import useAppMemo from '@hooks/useAppMemo'
import { useRestrictUser } from '@context/restrict-user'
import { toTokenAmount } from '@utils/calculations'
import { formatNumber } from '@utils/formatter'
import { BULL_EVENTS } from '@utils/amplitude'
import {
  BIG_ZERO,
  UNI_POOL_FEES,
  FUNDING_PERIOD,
  YEAR,
  INDEX_SCALE,
  VOL_PERCENT_FIXED,
  VOL_PERCENT_SCALAR,
} from '@constants/index'
import ethLogo from 'public/images/eth-logo.svg'
import { useZenBullStyles } from './styles'
import { BullTradeType, BullTransactionConfirmation } from './index'

const useStyles = makeStyles((theme) =>
  createStyles({
    description: {
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(1),
    },
    subDescription: {
      marginTop: theme.spacing(2),
      display: 'flex',
      alignItems: 'center',
      color: theme.palette.text.secondary,
    },
    infoIcon: {
      color: theme.palette.text.hint,
      fontSize: 14,
      marginLeft: theme.spacing(0.75),
    },
  }),
)

const TooltipTitle = () => (
  <>
    <Typography variant="caption">
      The recovery contract has undergone internal testing and an external peer review, but not audited. Use at your own
      discretion.
      <Link href="https://opyn.gitbook.io/zen-bull-euler-exploit-faq/" target="_blank" style={{ marginLeft: '4px' }}>
        Learn more.
      </Link>
    </Typography>
  </>
)

enum Step {
  OPYN = 1,
  EULER = 2,
}

const EmergencyWithdraw: React.FC<{
  onTxnConfirm: (txn: BullTransactionConfirmation) => void
  isLoadingBalance: boolean
  bullBalance: BigNumber
}> = ({ onTxnConfirm, isLoadingBalance, bullBalance }) => {
  const zenBullClasses = useZenBullStyles()
  const classes = useStyles()

  const [step, setStep] = useState(Step.OPYN)

  const [ethToWithdrawInput, setEthToWithdrawInput] = useState('0')
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quote, setQuote] = useState({
    maxEthForWPowerPerp: BIG_ZERO,
    ethInForOsqth: BIG_ZERO,
    osqthOut: BIG_ZERO,
    wPowerPerpPoolFee: 0,
    priceImpact: 0,
  })
  const [txLoading, setTxLoading] = useState(false)

  const [slippage, setSlippage] = useAtom(crabStrategySlippageAtomV2)
  const index = useAtomValue(indexAtom)
  const connected = useAtomValue(connectedWalletAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const { bullStrategy, bullEmergencyWithdraw } = useAtomValue(addressesAtom)
  const bullValueInEth = useAtomValue(bullCrabValueInEth)
  const bullPositionValueInEth = useAtomValue(bullCrabPositionValueInEth)
  const impliedVol = useAtomValue(impliedVolAtom)
  const normFactor = useAtomValue(normFactorAtom)

  const { track } = useAmplitude()
  const getEmergencyWithdrawParams = useGetEmergencyWithdrawParams()
  const bullEmergencyWithdrawEthFromCrab = useBullEmergencyWithdrawEthFromCrab()

  const trackUserEnteredWithdrawAmount = useCallback(
    (amount: BigNumber) => track(BULL_EVENTS.EMERGENCY_WITHDRAW_BULL_AMOUNT_ENTERED, { amount: amount.toNumber() }),
    [track],
  )

  const bullWithdrawAmountRef = useRef(BIG_ZERO)
  const ongoingTransactionEthAmountRef = useRef(BIG_ZERO)

  const { allowance: bullAllowance, approve: approveBull } = useUserAllowance(bullStrategy, bullEmergencyWithdraw)
  const logAndRunTransaction = useTrackTransactionFlow()
  const [trackWithdrawAmountEnteredOnce, resetTracking] = useExecuteOnce(trackUserEnteredWithdrawAmount)
  const ethToWithdrawInputBN = useMemo(() => new BigNumber(ethToWithdrawInput), [ethToWithdrawInput])

  const debouncedGetWithdrawQuote = debounce(async (bullToWithdraw: BigNumber) => {
    // ignore if its not the most recent request
    if (!bullWithdrawAmountRef.current.isEqualTo(bullToWithdraw)) {
      return
    }

    setQuoteLoading(true)
    getEmergencyWithdrawParams(bullToWithdraw)
      .then((_quote) => {
        setQuote(_quote)
      })
      .finally(() => {
        setQuoteLoading(false)
      })
  }, 500)

  const onInputChange = useAppCallback(
    (ethToWithdraw: string) => {
      setEthToWithdrawInput(ethToWithdraw)

      const ethToWithdrawBN = new BigNumber(ethToWithdraw)
      ethToWithdrawBN.isGreaterThan(0) ? trackWithdrawAmountEnteredOnce(ethToWithdrawBN) : null

      const _bullToWithdraw = ethToWithdrawBN.div(bullPositionValueInEth).times(bullBalance)
      bullWithdrawAmountRef.current = _bullToWithdraw
      debouncedGetWithdrawQuote(_bullToWithdraw)
    },
    [bullBalance, bullPositionValueInEth, debouncedGetWithdrawQuote, trackWithdrawAmountEnteredOnce],
  )

  const setWithdrawMax = () => {
    track(BULL_EVENTS.EMERGENCY_WITHDRAW_BULL_SET_AMOUNT_MAX, {
      amount: bullPositionValueInEth.toNumber(),
    })
    onInputChange(bullPositionValueInEth.toString())
  }

  const onChangeSlippage = useCallback(
    (amount: BigNumber) => {
      track(BULL_EVENTS.EMERGENCY_WITHDRAW_BULL_CHANGE_SLIPPAGE, { percent: amount.toNumber() })
      setSlippage(amount.toNumber())
      onInputChange(ethToWithdrawInput)
    },
    [setSlippage, onInputChange, ethToWithdrawInput, track],
  )

  const onApproveClick = async () => {
    setTxLoading(true)
    try {
      await logAndRunTransaction(async () => {
        await approveBull(() => console.log('Approved'))
      }, BULL_EVENTS.APPROVE_EMERGENCY_WITHDRAW_BULL)
    } catch (e) {
      console.log(e)
    }
    setTxLoading(false)
  }

  const onTxnConfirmed = useCallback(
    (id?: string) => {
      onInputChange('0')

      onTxnConfirm({
        status: true,
        amount: ongoingTransactionEthAmountRef.current,
        tradeType: BullTradeType.Withdraw,
        txId: id,
      })
      resetTracking()
      ongoingTransactionEthAmountRef.current = new BigNumber(0)
    },
    [onTxnConfirm, resetTracking, onInputChange],
  )

  const onWithdrawClick = async () => {
    setTxLoading(true)
    try {
      ongoingTransactionEthAmountRef.current = ethToWithdrawInputBN

      const dataToTrack = {
        amount: bullWithdrawAmountRef.current.toNumber(),
        isPriceImpactHigh: showPriceImpactWarning,
        priceImpact: quote.priceImpact,
      }

      await bullEmergencyWithdrawEthFromCrab(
        bullWithdrawAmountRef.current,
        quote.maxEthForWPowerPerp,
        dataToTrack,
        onTxnConfirmed,
      )
    } catch (e) {
      console.log(e)
    }
    setTxLoading(false)
  }

  const ethIndexPrice = toTokenAmount(index, 18).sqrt()

  const withdrawError = useAppMemo(() => {
    if (ethToWithdrawInputBN.gt(bullPositionValueInEth)) {
      return 'Withdraw amount greater than strategy balance'
    }
  }, [ethToWithdrawInputBN, bullPositionValueInEth])

  const showPriceImpactWarning = useAppMemo(() => {
    const squeethPriceFromTrade = quote.ethInForOsqth.div(quote.osqthOut).times(1 - UNI_POOL_FEES / 1000_000)
    const scalingFactor = new BigNumber(INDEX_SCALE)
    const fundingPeriod = new BigNumber(FUNDING_PERIOD).div(YEAR)
    const executionVol = new BigNumber(
      Math.log(scalingFactor.times(squeethPriceFromTrade).div(normFactor.times(ethIndexPrice)).toNumber()),
    )
      .div(fundingPeriod)
      .sqrt()

    const showWarning = executionVol
      .minus(impliedVol)
      .abs()
      .gt(BigNumber.max(new BigNumber(impliedVol).times(VOL_PERCENT_SCALAR), VOL_PERCENT_FIXED))

    return showWarning
  }, [quote.ethInForOsqth, quote.osqthOut, normFactor, ethIndexPrice, impliedVol])

  const { isRestricted, isWithdrawAllowed } = useRestrictUser()
  const selectWallet = useSelectWallet()

  const bullAllowanceInEth = bullAllowance.times(bullValueInEth)

  const isInputEmpty = ethToWithdrawInputBN.isZero()

  return (
    <>
      <Stepper step={step} setStep={setStep} />

      {step === Step.OPYN ? (
        <>
          <Typography style={{ marginTop: '16px' }} variant="h3" className={zenBullClasses.subtitle}>
            Recovery Withdrawal - Crab
          </Typography>

          <Typography variant="body2" className={classes.description}>
            Use recovery withdrawal to withdraw the Crab portion of a Zen Bull position.{' '}
            <Link href="https://opyn.gitbook.io/zen-bull-euler-exploit-faq/" target="_blank">
              Learn more.
            </Link>
          </Typography>

          <div className={classes.subDescription}>
            <Typography variant="body2">Recovery contract has been peer reviewed</Typography>
            <Tooltip title={<TooltipTitle />} interactive>
              <HelpOutlineIcon fontSize="small" className={classes.infoIcon} />
            </Tooltip>
          </div>

          <div className={zenBullClasses.tradeContainer}>
            <InputToken
              id="bull-withdraw-eth-input"
              value={ethToWithdrawInput}
              onInputChange={onInputChange}
              isBalanceLoading={isLoadingBalance}
              balance={bullPositionValueInEth}
              logo={ethLogo}
              symbol={'ETH'}
              usdPrice={ethIndexPrice}
              error={!!withdrawError}
              helperText={withdrawError}
              onBalanceClick={setWithdrawMax}
            />

            {showPriceImpactWarning ? (
              <div className={zenBullClasses.notice}>
                <div className={zenBullClasses.infoIcon}>
                  <Tooltip
                    title={
                      'High price impact means that you are losing a significant amount of value due to the size of your trade. Withdrawing a smaller size can reduce your price impact.'
                    }
                  >
                    <InfoIcon fontSize="medium" />
                  </Tooltip>
                </div>
                <Typography variant="caption" className={zenBullClasses.infoText}>
                  High price impact. Try multiple smaller transactions.
                </Typography>
              </div>
            ) : null}

            <Box display="flex" flexDirection="column" gridGap="12px" marginTop="24px">
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                gridGap="12px"
                className={zenBullClasses.slippageContainer}
              >
                <Metric
                  label="Slippage"
                  value={formatNumber(slippage) + '%'}
                  isSmall
                  flexDirection="row"
                  justifyContent="space-between"
                  gridGap="12px"
                />

                <Box display="flex" alignItems="center" gridGap="12px" flex="1">
                  <Metric
                    label="Price Impact"
                    value={formatNumber(quote.priceImpact) + '%'}
                    isSmall
                    flexDirection="row"
                    justifyContent="space-between"
                    gridGap="12px"
                  />
                  <TradeSettings setSlippage={onChangeSlippage} slippage={new BigNumber(slippage)} />
                </Box>
              </Box>
            </Box>

            {isRestricted && <RestrictionInfo withdrawAllowed={isWithdrawAllowed} marginTop="24px" />}

            <Box marginTop="24px">
              {isRestricted && !isWithdrawAllowed ? (
                <PrimaryButtonNew
                  fullWidth
                  variant="contained"
                  onClick={selectWallet}
                  disabled={true}
                  id="bull-restricted-btn"
                >
                  {'Unavailable'}
                </PrimaryButtonNew>
              ) : !connected ? (
                <PrimaryButtonNew
                  fullWidth
                  variant="contained"
                  onClick={selectWallet}
                  disabled={false}
                  id="bull-select-wallet-btn"
                >
                  {'Connect Wallet'}
                </PrimaryButtonNew>
              ) : !supportedNetwork ? (
                <PrimaryButtonNew fullWidth variant="contained" disabled={true} id="bull-unsupported-network-btn">
                  {'Unsupported Network'}
                </PrimaryButtonNew>
              ) : bullAllowanceInEth.lt(ethToWithdrawInputBN) ? (
                <PrimaryButtonNew
                  fullWidth
                  id="bull-withdraw-btn"
                  variant={'contained'}
                  onClick={onApproveClick}
                  disabled={quoteLoading || txLoading || !!withdrawError || isInputEmpty}
                >
                  {!txLoading && !quoteLoading ? 'Approve' : <CircularProgress color="primary" size="2rem" />}
                </PrimaryButtonNew>
              ) : (
                <PrimaryButtonNew
                  fullWidth
                  id="bull-withdraw-btn"
                  variant="contained"
                  onClick={onWithdrawClick}
                  disabled={quoteLoading || txLoading || !!withdrawError || isInputEmpty}
                >
                  {!txLoading && !quoteLoading ? 'Withdraw' : <CircularProgress color="primary" size="2rem" />}
                </PrimaryButtonNew>
              )}
            </Box>
          </div>
        </>
      ) : (
        <>
          <Typography variant="h3" style={{ marginTop: '16px' }} className={zenBullClasses.subtitle}>
            Recovery Withdrawal - Euler
          </Typography>
          <Typography variant="body2" className={classes.description}>
            Go to Euler&apos;s redemption page to claim funds from Euler.{' '}
            <Link href="https://opyn.gitbook.io/zen-bull-euler-exploit-faq/" target="_blank">
              Learn more.
            </Link>
          </Typography>
          <div className={zenBullClasses.tradeContainer}>
            <a style={{ width: '100%' }} href="https://redemptions.euler.finance/" target="_blank" rel="noreferrer">
              <PrimaryButtonNew style={{ marginTop: '16px', width: '100%' }}>Go to Redemption page</PrimaryButtonNew>
            </a>
          </div>
        </>
      )}
    </>
  )
}

const useStepperStyles = makeStyles((theme) =>
  createStyles({
    container: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing(1),
    },
    stepData: {
      marginTop: theme.spacing(0),
      fontFamily: 'DM Mono',
      textAlign: 'center',
      fontSize: '14px',
    },
    stepButton: {
      padding: theme.spacing(0.5),
      margin: theme.spacing(0, 0.5),
      '&:disabled': {
        background: theme.palette.background.lightStone,
        opacity: '0.5',
      },
    },
    disabled: {
      backgroundColor: theme.palette.background.lightStone,
      opacity: '1',
    },
  }),
)

const StepperIconButton = withStyles((theme) => ({
  root: {
    background: theme.palette.background.stone,
  },
  disabled: {
    background: theme.palette.background.stone,
    opacity: '1',
  },
}))(IconButton)

const Stepper: React.FC<{ step: number; setStep: (step: number) => void }> = ({ setStep, step }) => {
  const classes = useStepperStyles()

  return (
    <div>
      <div className={classes.container}>
        <StepperIconButton
          id="lp-prev-step-btn"
          className={classes.stepButton}
          classes={{ disabled: classes.disabled }}
          disabled={step === 1}
          onClick={() => setStep(step - 1)}
        >
          <ArrowBackIcon fontSize="small" />
        </StepperIconButton>
        <StepperIconButton
          id="lp-next-step-btn"
          className={classes.stepButton}
          classes={{ disabled: classes.disabled }}
          disabled={step === 2}
          onClick={() => setStep(step + 1)}
        >
          <ArrowForwardIcon fontSize="small" />
        </StepperIconButton>
      </div>
      <Typography className={classes.stepData}>
        0<span id="current-lp-step">{step}</span> / 02
      </Typography>{' '}
    </div>
  )
}

export default EmergencyWithdraw

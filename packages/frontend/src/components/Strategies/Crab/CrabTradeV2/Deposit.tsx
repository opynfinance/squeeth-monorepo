import { Box, CircularProgress, Tooltip, Typography } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { useDebounce } from 'use-debounce'
import InfoIcon from '@material-ui/icons/Info'
import { PrimaryButtonNew, RoundedButton } from '@components/Button'
import { TradeSettings } from '@components/TradeSettings'
import RestrictionInfo from '@components/RestrictionInfo'
import { InputToken } from '@components/InputNew'
import Metric, { MetricLabel } from '@components/Metric'
import { addressAtom, connectedWalletAtom, networkIdAtom, supportedNetworkAtom } from '@state/wallet/atoms'
import { useTransactionStatus, useSelectWallet } from '@state/wallet/hooks'
import {
  crabStrategySlippageAtomV2,
  usdcQueuedAtom,
  minUSDCAmountAtom,
  maxCapAtomV2,
  crabStrategyVaultAtomV2,
  totalUsdcQueuedAtom,
  totalCrabQueueInUsddAtom,
} from '@state/crab/atoms'
import {
  useSetStrategyDataV2,
  useCalculateETHtoBorrowFromUniswapV2,
  useFlashDepositUSDC,
  useQueueDepositUSDC,
} from '@state/crab/hooks'
import { readyAtom } from '@state/squeethPool/atoms'
import { impliedVolAtom, indexAtom, normFactorAtom, osqthRefVolAtom } from '@state/controller/atoms'
import { addressesAtom } from '@state/positions/atoms'
import useAppMemo from '@hooks/useAppMemo'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import { useUniswapQuoter } from '@hooks/useUniswapQuoter'
import { useUserAllowance } from '@hooks/contracts/useAllowance'
import useStateWithReset from '@hooks/useStateWithReset'
import {
  BIG_ZERO,
  FUNDING_PERIOD,
  INDEX_SCALE,
  USDC_DECIMALS,
  VOL_PERCENT_FIXED,
  VOL_PERCENT_SCALAR,
  WETH_DECIMALS,
  YEAR,
  AVERAGE_AUCTION_PRICE_IMPACT,
  NETTING_PRICE_IMPACT,
} from '@constants/index'
import { useRestrictUser } from '@context/restrict-user'
import { fromTokenAmount, getUSDCPoolFee, toTokenAmount } from '@utils/calculations'
import { formatNumber } from '@utils/formatter'
import usdcLogo from 'public/images/usdc-logo.svg'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'
import HelpOutlineIcon from '@material-ui/icons/HelpOutline'
import { useStyles } from './styles'
import { CrabTradeTransactionType, CrabTradeType, CrabTransactionConfirmation, OngoingTransaction } from './types'
import { CRAB_EVENTS } from '@utils/amplitude'
import useAmplitude from '@hooks/useAmplitude'
import useExecuteOnce from '@hooks/useExecuteOnce'
import useTrackTransactionFlow from '@hooks/useTrackTransactionFlow'

type CrabDepositProps = {
  onTxnConfirm: (txn: CrabTransactionConfirmation) => void
}

enum DepositSteps {
  APPROVE = 'Approve USDC',
  DEPOSIT = 'Deposit',
}

const OTC_PRICE_IMPACT_THRESHOLD = Number(process.env.NEXT_PUBLIC_OTC_PRICE_IMPACT_THRESHOLD) || 1

const CrabDeposit: React.FC<CrabDepositProps> = ({ onTxnConfirm }) => {
  const classes = useStyles()
  const [depositAmount, setDepositAmount] = useState('0')
  const [debouncedDepositAmount] = useDebounce(depositAmount, 500)
  const ongoingTransaction = useRef<OngoingTransaction | undefined>()
  const depositAmountBN = useMemo(() => new BigNumber(debouncedDepositAmount), [debouncedDepositAmount])

  const [txLoading, setTxLoading] = useState(false)
  const [depositPriceImpact, setDepositPriceImpact, resetDepositPriceImpact] = useStateWithReset('0')
  const [borrowEth, setBorrowEth, resetBorrowEth] = useStateWithReset(new BigNumber(0))
  const [uniswapFee, setUniswapFee, resetUniswapFee] = useStateWithReset('0')
  const [squeethAmountInFromDeposit, setSqueethAmountInFromDeposit, resetSqueethAmountInFromDeposit] =
    useStateWithReset(new BigNumber(0))
  const [ethAmountOutFromDeposit, setEthAmountOutFromDeposit, resetEthAmountOutFromDeposit] = useStateWithReset(
    new BigNumber(0),
  )
  const [depositEthAmount, setDepositEthAmount] = useState(new BigNumber(0))
  const [queueOptionAvailable, setQueueOptionAvailable] = useState(false)
  const [useQueue, setUseQueue] = useState(false)
  const [depositStep, setDepositStep] = useState(DepositSteps.DEPOSIT)

  const minUSDCAmountValue = useAtomValue(minUSDCAmountAtom)

  const connected = useAtomValue(connectedWalletAtom)
  const [slippage, setSlippage] = useAtom(crabStrategySlippageAtomV2)
  const network = useAtomValue(networkIdAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const selectWallet = useSelectWallet()

  const { usdc, weth, crabHelper, crabNetting } = useAtomValue(addressesAtom)
  const { value: usdcBalance, refetch: refetchUsdcBalance } = useTokenBalance(usdc, 15, USDC_DECIMALS)
  const { getExactIn } = useUniswapQuoter()
  const setStrategyData = useSetStrategyDataV2()
  const calculateETHtoBorrowFromUniswap = useCalculateETHtoBorrowFromUniswapV2()
  const flashDepositUSDC = useFlashDepositUSDC(calculateETHtoBorrowFromUniswap)
  const queueUSDC = useQueueDepositUSDC()
  const [usdcQueued, setUsdcQueued] = useAtom(usdcQueuedAtom)

  const index = useAtomValue(indexAtom)
  const ethIndexPrice = toTokenAmount(index, 18).sqrt()
  const { resetTransactionData } = useTransactionStatus()

  const ready = useAtomValue(readyAtom)
  const { isRestricted } = useRestrictUser()

  const { allowance: usdcAllowance, approve: approveUsdc } = useUserAllowance(usdc, crabHelper, USDC_DECIMALS)
  const { allowance: usdcQueueAllowance, approve: approveQueueUsdc } = useUserAllowance(
    usdc,
    crabNetting,
    USDC_DECIMALS,
  )

  const maxCap = useAtomValue(maxCapAtomV2)
  const vault = useAtomValue(crabStrategyVaultAtomV2)
  const impliedVol = useAtomValue(impliedVolAtom)
  const normFactor = useAtomValue(normFactorAtom)
  const osqthRefVol = useAtomValue(osqthRefVolAtom)
  const { track } = useAmplitude()

  const trackUserEnteredDepositAmount = useCallback(
    (amount: BigNumber) => track(CRAB_EVENTS.DEPOSIT_CRAB_AMOUNT_ENTERED, { amount: amount.toNumber() }),
    [track],
  )

  const [trackDepositAmountEnteredOnce, resetTracking] = useExecuteOnce(trackUserEnteredDepositAmount)
  const logAndRunTransaction = useTrackTransactionFlow()

  const onInputChange = useCallback(
    (amount: string) => {
      setDepositAmount(amount)
      const deposit = new BigNumber(amount)
      deposit.isGreaterThan(0) ? trackDepositAmountEnteredOnce(deposit) : null
    },
    [setDepositAmount, trackDepositAmountEnteredOnce],
  )

  const depositedAmount = vault?.collateralAmount ?? BIG_ZERO

  const depositPriceImpactWarning = useAppMemo(() => {
    if (useQueue) return false

    const squeethPrice = ethAmountOutFromDeposit.div(squeethAmountInFromDeposit).times(1.003)
    const scalingFactor = new BigNumber(INDEX_SCALE)
    const fundingPeriod = new BigNumber(FUNDING_PERIOD).div(YEAR)
    const log = Math.log(scalingFactor.times(squeethPrice).div(normFactor.times(ethIndexPrice)).toNumber())
    const executionVol = new BigNumber(log).div(fundingPeriod).sqrt()

    const showPriceImpactWarning =
      log < 0 ||
      executionVol
        .minus(impliedVol)
        .abs()
        .gt(BigNumber.max(new BigNumber(impliedVol).times(VOL_PERCENT_SCALAR), VOL_PERCENT_FIXED))
    return showPriceImpactWarning
  }, [impliedVol, ethAmountOutFromDeposit, squeethAmountInFromDeposit, useQueue, ethIndexPrice, normFactor])

  const depositFundingWarning = useAppMemo(() => {
    const impliedVolDiff = new BigNumber(-VOL_PERCENT_SCALAR)
    const impliedVolDiffLowVol = new BigNumber(-VOL_PERCENT_FIXED)
    // const dailyHistoricalImpliedVol = new BigNumber(dailyHistoricalFunding.funding).times(YEAR).sqrt()
    const threshold = BigNumber.max(
      new BigNumber(osqthRefVol / 100).times(new BigNumber(1).plus(impliedVolDiff)),
      new BigNumber(osqthRefVol / 100).plus(impliedVolDiffLowVol),
    )

    const showFundingWarning = new BigNumber(impliedVol).lt(threshold) ? true : false
    return showFundingWarning
  }, [osqthRefVol, impliedVol])

  const depositError = useAppMemo(() => {
    let inputError

    if (connected) {
      if (depositEthAmount.plus(depositedAmount).gte(maxCap)) {
        inputError = 'Amount greater than strategy cap'
      } else if (depositEthAmount.plus(depositedAmount).plus(borrowEth).gte(maxCap)) {
        inputError = `Amount greater than strategy cap since it flash borrows ${borrowEth.toFixed(
          2,
        )} ETH. Input a smaller amount`
      } else if (usdcBalance.lt(depositAmountBN)) {
        inputError = 'Insufficient USDC balance'
      }
    }

    return inputError
  }, [connected, depositEthAmount, depositAmountBN, depositedAmount, maxCap, borrowEth, usdcBalance])

  useEffect(() => {
    if (!ready) {
      return
    }

    if (depositAmountBN.isZero()) {
      resetDepositPriceImpact()
      resetUniswapFee()
      resetBorrowEth()
      resetEthAmountOutFromDeposit()
      resetSqueethAmountInFromDeposit()
      return
    }

    const fee = getUSDCPoolFee(network)
    getExactIn(usdc, weth, fromTokenAmount(depositAmountBN, USDC_DECIMALS), fee, slippage).then((usdcq) => {
      setDepositEthAmount(toTokenAmount(usdcq.amountOut, WETH_DECIMALS))
      calculateETHtoBorrowFromUniswap(toTokenAmount(usdcq.minAmountOut, WETH_DECIMALS), slippage).then((q) => {
        setBorrowEth(q.ethBorrow)
        setEthAmountOutFromDeposit(q.amountOut)
        setSqueethAmountInFromDeposit(q.initialWSqueethDebt)
        let quotePriceImpact = q.priceImpact
        if (q.poolFee) quotePriceImpact = (Number(q.priceImpact) - Number(q.poolFee)).toFixed(2)

        setDepositPriceImpact(quotePriceImpact)
        setUniswapFee(q.poolFee)
      })
    })
  }, [ready, depositAmountBN, slippage, network, usdc, weth])

  const recordAnalytics = useCallback(
    (events: string[]) => {
      events.forEach((event) => track(event))
    },
    [track],
  )

  const onTxnConfirmed = useCallback(
    (id?: string) => {
      if (!ongoingTransaction.current) return
      const transaction = ongoingTransaction.current
      if (transaction.queuedTransaction)
        setUsdcQueued(usdcQueued.plus(fromTokenAmount(transaction.amount, USDC_DECIMALS)))
      else {
        setStrategyData()
      }
      onTxnConfirm({
        status: true,
        amount: transaction.amount,
        tradeType: CrabTradeType.Deposit,
        transactionType: transaction.queuedTransaction
          ? CrabTradeTransactionType.Queued
          : CrabTradeTransactionType.Instant,
        token: transaction.token,
        id,
      })
      transaction.analytics ? recordAnalytics(transaction.analytics) : null
      onInputChange('0')
      resetTracking()
      refetchUsdcBalance()
      ongoingTransaction.current = undefined
    },
    [
      usdcQueued,
      setUsdcQueued,
      setStrategyData,
      onTxnConfirm,
      onInputChange,
      refetchUsdcBalance,
      recordAnalytics,
      resetTracking,
    ],
  )

  const depositTX = async () => {
    setTxLoading(true)

    try {
      if (depositStep === DepositSteps.APPROVE) {
        if (useQueue) {
          await logAndRunTransaction(async () => {
            await approveQueueUsdc(() => resetTransactionData())
          }, CRAB_EVENTS.APPROVE_DEPOSIT_STN_CRAB_USDC)
        } else {
          await logAndRunTransaction(async () => {
            await approveUsdc(() => resetTransactionData())
          }, CRAB_EVENTS.APPROVE_DEPOSIT_CRAB_USDC)
        }
      } else {
        const userForceInstantAnalytics = queueOptionAvailable && !useQueue
        ongoingTransaction.current = {
          amount: depositAmountBN,
          queuedTransaction: useQueue,
          token: 'USDC',
          analytics: userForceInstantAnalytics ? [CRAB_EVENTS.USER_FORCE_INSTANT_DEP_CRAB] : undefined,
        }
        if (useQueue) {
          await queueUSDC(depositAmountBN, onTxnConfirmed)
        } else {
          await flashDepositUSDC(depositAmountBN, slippage, onTxnConfirmed)
        }
      }
    } catch (e) {
      console.log(e)
      resetTracking()
      setTxLoading(false)
    }
    setTxLoading(false)
  }

  const setDepositMax = () => {
    onInputChange(usdcBalance.toString())
  }

  // Update deposit step
  useEffect(() => {
    if (useQueue) {
      if (usdcQueueAllowance.lt(depositAmountBN)) {
        setDepositStep(DepositSteps.APPROVE)
      } else {
        setDepositStep(DepositSteps.DEPOSIT)
      }
    } else {
      if (usdcAllowance.lt(depositAmountBN)) {
        setDepositStep(DepositSteps.APPROVE)
      } else {
        setDepositStep(DepositSteps.DEPOSIT)
      }
    }
  }, [usdcAllowance, depositAmountBN, useQueue, usdcQueueAllowance])

  const minUSDCAmount = toTokenAmount(minUSDCAmountValue, USDC_DECIMALS)
  const isDepositAmountLessThanMinAllowed = depositAmountBN.lt(minUSDCAmount)

  useEffect(() => {
    if (isDepositAmountLessThanMinAllowed) {
      setQueueOptionAvailable(false)
      setUseQueue(false)
      return
    }

    if (Number(depositPriceImpact) + Number(uniswapFee) > OTC_PRICE_IMPACT_THRESHOLD) {
      setQueueOptionAvailable(true)
      setUseQueue(true)
    } else {
      setQueueOptionAvailable(false)
      setUseQueue(false)
    }
  }, [depositPriceImpact, isDepositAmountLessThanMinAllowed, uniswapFee])

  const totalDepositsQueued = useAtomValue(totalUsdcQueuedAtom)
  const totalWithdrawsQueued = useAtomValue(totalCrabQueueInUsddAtom)

  const depositPriceImpactNumber = useAppMemo(() => {
    if (!useQueue) return Number(depositPriceImpact)

    const totalWithdraws = totalWithdrawsQueued.minus(totalDepositsQueued).isNegative()
      ? new BigNumber(0)
      : totalWithdrawsQueued.minus(totalDepositsQueued)

    const nettingDepositAmount = totalWithdraws.gt(depositAmountBN) ? depositAmountBN : totalWithdraws
    const remainingDeposit = depositAmountBN.minus(nettingDepositAmount)

    const priceImpact = nettingDepositAmount
      .times(NETTING_PRICE_IMPACT)
      .plus(remainingDeposit.times(AVERAGE_AUCTION_PRICE_IMPACT))
      .div(depositAmountBN)
      .toNumber()

    return priceImpact
  }, [depositAmountBN, depositPriceImpact, totalDepositsQueued, totalWithdrawsQueued, useQueue])

  const depositBtnVariant =
    depositPriceImpactNumber > 3 || depositFundingWarning || depositPriceImpactWarning ? 'outlined' : 'contained'
  const depositBtnClassName =
    depositPriceImpactNumber > 3
      ? classes.btnDanger
      : depositFundingWarning || depositPriceImpactWarning
      ? classes.btnWarning
      : ''

  return (
    <>
      <Box display="flex" justifyContent="space-between" alignItems="center" gridGap="12px">
        <Typography variant="h3" className={classes.subtitle}>
          Strategy Deposit
        </Typography>
      </Box>

      <Box display="flex" alignItems="center" gridGap="12px" marginTop="16px">
        <RoundedButton
          variant="outlined"
          size="small"
          onClick={() => setUseQueue(false)}
          className={!useQueue ? classes.btnActive : classes.btnDefault}
        >
          Instant
        </RoundedButton>
        <RoundedButton
          disabled={!queueOptionAvailable}
          variant={!queueOptionAvailable ? 'contained' : 'outlined'}
          size="small"
          onClick={() => setUseQueue(true)}
          className={useQueue ? classes.btnActive : classes.btnDefault}
        >
          Standard
        </RoundedButton>
        <Box className={classes.infoIconGray} display="flex" alignItems="center">
          <Tooltip
            title={`Standard deposit helps large deposits reduce price impact. Standard deposits get into the strategy in 24 hours on average, but could take up to Tuesday at the longest. Instant deposits get into the strategy immediately.`}
          >
            <HelpOutlineIcon fontSize="medium" />
          </Tooltip>
        </Box>
      </Box>

      <div className={classes.tradeContainer}>
        <InputToken
          id="crab-deposit-usdc-input"
          value={depositAmount}
          onInputChange={onInputChange}
          balance={usdcBalance}
          logo={usdcLogo}
          symbol={'USDC'}
          usdPrice={new BigNumber(1)}
          onBalanceClick={setDepositMax}
          error={!!depositError}
          helperText={depositError}
        />

        {depositFundingWarning && !useQueue && (
          <div className={classes.notice}>
            <div className={classes.infoIcon}>
              <Tooltip
                title={
                  'The strategy sells squeeth to earn premium. Premium is currently lower than usual. You can still deposit, but you may be more likely to have negative returns.'
                }
              >
                <InfoIcon fontSize="medium" />
              </Tooltip>
            </div>
            <Typography variant="caption" className={classes.infoText}>
              Crab premium is currently lower than usual. Consider depositing later.
            </Typography>
          </div>
        )}

        {depositPriceImpactWarning && (
          <div className={classes.notice}>
            <div className={classes.infoIcon}>
              <Tooltip
                title={
                  'High price impact means that you are losing a significant amount of value due to the size of your trade. Depositing a smaller size can reduce your price impact.'
                }
              >
                <InfoIcon fontSize="medium" />
              </Tooltip>
            </div>
            <Typography variant="caption" className={classes.infoText}>
              High price impact. Try multiple smaller transactions or standard deposit
            </Typography>
          </div>
        )}

        <Box marginTop="24px">
          <Box display="flex" alignItems="center" justifyContent="space-between" gridGap="12px" flexWrap="wrap">
            <Metric
              label="Uniswap Fee"
              value={useQueue ? '0%' : formatNumber(Number(uniswapFee)) + '%'}
              isSmall
              flexDirection="row"
              justifyContent="space-between"
              gridGap="8px"
            />

            <Box display="flex" alignItems="center" gridGap="6px" flex="1">
              <Metric
                label={
                  <MetricLabel
                    label={useQueue ? 'Est. Price Impact' : 'Price Impact'}
                    tooltipTitle={useQueue ? 'Average price impact based on historical standard deposits' : undefined}
                  />
                }
                value={formatNumber(depositPriceImpactNumber) + '%'}
                textColor={depositPriceImpactNumber > 3 ? 'error' : undefined}
                isSmall
                flexDirection="row"
                justifyContent="space-between"
                gridGap="8px"
              />

              {!useQueue && (
                <TradeSettings setSlippage={(amt) => setSlippage(amt.toNumber())} slippage={new BigNumber(slippage)} />
              )}
            </Box>
          </Box>
        </Box>

        <div className={classes.ctaSection}>
          {/* {useQueue && (
            <div className={classes.queueNotice}>
              <Typography variant="subtitle2" color="primary">
                To reduce price impact, your deposit may take up until Tuesday to enter the strategy
              </Typography>
            </div>
          )} */}

          {isRestricted && <RestrictionInfo />}

          <div>
            {isRestricted ? (
              <PrimaryButtonNew
                fullWidth
                variant="contained"
                onClick={selectWallet}
                disabled={true}
                id="open-long-restricted-btn"
              >
                {'Unavailable'}
              </PrimaryButtonNew>
            ) : !connected ? (
              <PrimaryButtonNew
                fullWidth
                variant="contained"
                onClick={selectWallet}
                disabled={!!txLoading}
                id="crab-select-wallet-btn"
              >
                {'Connect Wallet'}
              </PrimaryButtonNew>
            ) : !supportedNetwork ? (
              <PrimaryButtonNew
                fullWidth
                variant="contained"
                onClick={() => {}}
                disabled={true}
                id="crab-unsupported-network-btn"
              >
                {'Unsupported Network'}
              </PrimaryButtonNew>
            ) : (
              <PrimaryButtonNew
                fullWidth
                id="crab-deposit-btn"
                variant={depositBtnVariant}
                className={depositBtnClassName}
                onClick={depositTX}
                disabled={txLoading || !!depositError}
              >
                {!txLoading && useQueue && depositStep === DepositSteps.DEPOSIT ? (
                  <>
                    Standard deposit
                    <Tooltip
                      title={
                        <div>
                          Your deposit will be submitted via auction to reduce price impact. This may take until
                          Tuesday.
                        </div>
                      }
                      style={{ marginLeft: '8' }}
                    >
                      <InfoOutlinedIcon fontSize="small" />
                    </Tooltip>
                  </>
                ) : !txLoading &&
                  (depositFundingWarning || depositPriceImpactWarning) &&
                  depositStep === DepositSteps.DEPOSIT ? (
                  'Deposit anyway'
                ) : !txLoading ? (
                  depositStep
                ) : (
                  <CircularProgress color="primary" size="1.5rem" />
                )}
              </PrimaryButtonNew>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default CrabDeposit

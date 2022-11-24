import { Box, CircularProgress, Switch, Tooltip, Typography } from '@material-ui/core'
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
  currentCrabPositionETHActualAtomV2,
  currentCrabPositionValueAtomV2,
  isNettingAuctionLiveAtom,
  crabQueuedAtom,
  minCrabAmountAtom,
} from '@state/crab/atoms'
import {
  useSetStrategyDataV2,
  useFlashWithdrawEthV2,
  useCalculateEthWillingToPayV2,
  useClaimAndWithdrawEthV2,
  useETHtoCrab,
  useFlashWithdrawV2USDC,
  useQueueWithdrawCrab,
} from '@state/crab/hooks'
import { readyAtom } from '@state/squeethPool/atoms'
import { useUserCrabV2TxHistory } from '@hooks/useUserCrabV2TxHistory'
import { usePrevious } from 'react-use'
import { dailyHistoricalFundingAtom, impliedVolAtom, indexAtom, normFactorAtom } from '@state/controller/atoms'
import { addressesAtom } from '@state/positions/atoms'
import { userMigratedSharesETHAtom } from '@state/crabMigration/atom'
import { useUpdateSharesData } from '@state/crabMigration/hooks'
import useAppMemo from '@hooks/useAppMemo'
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
  YEAR,
  AVERAGE_AUCTION_PRICE_IMPACT,
  CRAB_TOKEN_DECIMALS,
} from '@constants/index'
import { useRestrictUser } from '@context/restrict-user'
import { fromTokenAmount, getUSDCPoolFee, toTokenAmount } from '@utils/calculations'
import { formatNumber } from '@utils/formatter'
import ethLogo from 'public/images/eth-logo.svg'
import usdcLogo from 'public/images/usdc-logo.svg'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'
import HelpOutlineIcon from '@material-ui/icons/HelpOutline'
import { useStyles } from './styles'
import { CrabTradeTransactionType, CrabTradeType, CrabTransactionConfirmation, OngoingTransaction } from './types'
import { CRAB_EVENTS } from '@utils/amplitude'
import useAmplitude from '@hooks/useAmplitude'
import useExecuteOnce from '@hooks/useExecuteOnce'

enum WithdrawSteps {
  APPROVE = 'Approve CRAB',
  WITHDRAW = 'Withdraw',
}

const OTC_PRICE_IMPACT_THRESHOLD = Number(process.env.NEXT_PUBLIC_OTC_PRICE_IMPACT_THRESHOLD) || 1
console.log(OTC_PRICE_IMPACT_THRESHOLD)

const CrabWithdraw: React.FC<{ onTxnConfirm: (txn: CrabTransactionConfirmation) => void }> = ({ onTxnConfirm }) => {
  const classes = useStyles()
  const [withdrawAmount, setWithdrawAmount, resetWithdrawAmount] = useStateWithReset('0')
  const [debouncedWithdrawAmount] = useDebounce(withdrawAmount, 500)
  const withdrawAmountBN = useMemo(() => new BigNumber(debouncedWithdrawAmount), [debouncedWithdrawAmount])
  const ongoingTransaction = useRef<OngoingTransaction | undefined>()
  const [txLoading, setTxLoading] = useState(false)
  const [withdrawPriceImpact, setWithdrawPriceImpact, resetWithdrawPriceImpact] = useStateWithReset('0')
  const [ethAmountInFromWithdraw, setEthAmountInFromWithdraw, resetEthAmountInFromWithdraw] = useStateWithReset(
    new BigNumber(0),
  )
  const [usdcAmountOutFromWithdraw, setUSDCAmountOutFromWithdraw, resetUSDCAmountOutFromWithdraw] = useStateWithReset(
    new BigNumber(0),
  )
  const [squeethAmountOutFromWithdraw, setSqueethAmountOutFromWithdraw, resetSqueethAmountOutFromWithdraw] =
    useStateWithReset(new BigNumber(0))
  const [useUsdc, setUseUsdc] = useState(true)
  const [queueOptionAvailable, setQueueOptionAvailable] = useState(false)
  const [useQueue, setUseQueue] = useState(false)
  const [withdrawStep, setWithdrawStep] = useState(WithdrawSteps.WITHDRAW)

  const isNettingAuctionLive = useAtomValue(isNettingAuctionLiveAtom)
  const minCrabAmountValue = useAtomValue(minCrabAmountAtom)

  const connected = useAtomValue(connectedWalletAtom)
  const currentEthActualValue = useAtomValue(currentCrabPositionETHActualAtomV2)
  const currentUsdcValue = useAtomValue(currentCrabPositionValueAtomV2)
  const migratedCurrentEthValue = useAtomValue(userMigratedSharesETHAtom)
  const [slippage, setSlippage] = useAtom(crabStrategySlippageAtomV2)
  const network = useAtomValue(networkIdAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const selectWallet = useSelectWallet()

  const currentEthValue = migratedCurrentEthValue.gt(0) ? migratedCurrentEthValue : currentEthActualValue
  const isClaimAndWithdraw = migratedCurrentEthValue.gt(0)

  const { usdc, weth, crabHelper, crabStrategy2, crabNetting } = useAtomValue(addressesAtom)
  const { getExactIn } = useUniswapQuoter()
  const setStrategyData = useSetStrategyDataV2()
  const flashWithdrawEth = useFlashWithdrawEthV2()
  const claimAndWithdrawEth = useClaimAndWithdrawEthV2()
  const calculateEthWillingToPay = useCalculateEthWillingToPayV2()
  const updateSharesData = useUpdateSharesData()
  const flashWithdrawUSDC = useFlashWithdrawV2USDC()
  const queueCRAB = useQueueWithdrawCrab()
  const getUserCrabForEthAmount = useETHtoCrab()
  const [crabQueued, setCrabQueued] = useAtom(crabQueuedAtom)

  const index = useAtomValue(indexAtom)
  const ethIndexPrice = toTokenAmount(index, 18).sqrt()
  const { confirmed, resetTransactionData } = useTransactionStatus()

  const ready = useAtomValue(readyAtom)
  const { isRestricted } = useRestrictUser()

  const dailyHistoricalFunding = useAtomValue(dailyHistoricalFundingAtom)

  const address = useAtomValue(addressAtom)
  const { allowance: crabAllowance, approve: approveCrab } = useUserAllowance(crabStrategy2, crabHelper)
  const { allowance: crabQueueAllowance, approve: approveQueueCrab } = useUserAllowance(crabStrategy2, crabNetting)
  const { data, startPolling, stopPolling } = useUserCrabV2TxHistory(address ?? '')

  const prevCrabTxData = usePrevious(data)

  const impliedVol = useAtomValue(impliedVolAtom)
  const normFactor = useAtomValue(normFactorAtom)

  const { track } = useAmplitude()

  const trackUserEnteredWithdrawAmount = useCallback(
    (amount: BigNumber) => track(CRAB_EVENTS.WITHDRAW_CRAB_AMOUNT_ENTERED, { amount: amount.toNumber() }),
    [track],
  )
  const [trackWithdrawAmountEnteredOnce, resetTracking] = useExecuteOnce(trackUserEnteredWithdrawAmount)

  const onInputChange = useCallback(
    (amount: string) => {
      setWithdrawAmount(amount)
      const withdraw = new BigNumber(amount)
      withdraw.isGreaterThan(0) ? trackWithdrawAmountEnteredOnce(withdraw) : null
    },
    [setWithdrawAmount, trackWithdrawAmountEnteredOnce],
  )

  const recordAnalytics = useCallback(
    (events: string[]) => {
      events.forEach((event) => track(event))
    },
    [track],
  )

  useEffect(() => {
    if (confirmed && prevCrabTxData?.length === data?.length) {
      startPolling(500)
    } else {
      stopPolling()
    }
  }, [confirmed, prevCrabTxData?.length, data?.length])

  const withdrawPriceImpactWarning = useAppMemo(() => {
    if (useQueue) return false

    const squeethPrice = ethAmountInFromWithdraw.div(squeethAmountOutFromWithdraw)
    const scalingFactor = new BigNumber(INDEX_SCALE)
    const fundingPeriod = new BigNumber(FUNDING_PERIOD).div(YEAR)
    const executionVol = new BigNumber(
      Math.log(scalingFactor.times(squeethPrice).div(normFactor.times(ethIndexPrice)).toNumber()),
    )
      .div(fundingPeriod)
      .sqrt()

    const showPriceImpactWarning = executionVol
      .minus(impliedVol)
      .abs()
      .gt(BigNumber.max(new BigNumber(impliedVol).times(VOL_PERCENT_SCALAR), VOL_PERCENT_FIXED))
    return showPriceImpactWarning
  }, [impliedVol, ethAmountInFromWithdraw, squeethAmountOutFromWithdraw, useQueue, ethIndexPrice, normFactor])

  const withdrawFundingWarning = useAppMemo(() => {
    const impliedVolDiff = new BigNumber(VOL_PERCENT_SCALAR)
    const impliedVolDiffLowVol = new BigNumber(VOL_PERCENT_FIXED)
    const dailyHistoricalImpliedVol = new BigNumber(dailyHistoricalFunding.funding).times(YEAR).sqrt()
    const threshold = BigNumber.max(
      dailyHistoricalImpliedVol.times(new BigNumber(1).plus(impliedVolDiff)),
      dailyHistoricalImpliedVol.plus(impliedVolDiffLowVol),
    )

    const fundingWarning = new BigNumber(impliedVol).gt(threshold) ? true : false
    return fundingWarning
  }, [dailyHistoricalFunding.funding, impliedVol])

  const withdrawError = useAppMemo(() => {
    let withdrawError: string | undefined

    if (connected) {
      if (!useUsdc && withdrawAmountBN.gt(currentEthValue)) {
        withdrawError = 'Withdraw amount greater than strategy balance'
      } else if (useUsdc && withdrawAmountBN.gt(currentUsdcValue)) {
        withdrawError = 'Withdraw amount greater than strategy balance'
      }
    }

    return withdrawError
  }, [connected, withdrawAmountBN, currentEthValue, currentUsdcValue, useUsdc])

  const withdrawEthAmount = useAppMemo(() => {
    if (!useUsdc) return withdrawAmountBN
    else {
      if (currentUsdcValue.isZero()) return BIG_ZERO
      return withdrawAmountBN.div(currentUsdcValue).times(currentEthValue)
    }
  }, [withdrawAmountBN, useUsdc, currentUsdcValue, currentEthValue])

  const withdrawCrabAmount = useAppMemo(() => {
    return getUserCrabForEthAmount(withdrawEthAmount || BIG_ZERO)
  }, [withdrawEthAmount, getUserCrabForEthAmount])

  useEffect(() => {
    if (!ready) {
      return
    }

    if (withdrawCrabAmount.isZero()) {
      resetWithdrawPriceImpact()
      resetEthAmountInFromWithdraw()
      resetSqueethAmountOutFromWithdraw()
      resetUSDCAmountOutFromWithdraw()
      return
    }

    if (!useUsdc) {
      calculateEthWillingToPay(withdrawCrabAmount, slippage).then((q) => {
        setWithdrawPriceImpact(q.priceImpact)
        setEthAmountInFromWithdraw(q.amountIn)
        setSqueethAmountOutFromWithdraw(q.squeethDebt)
      })
    } else {
      const fee = getUSDCPoolFee(network)
      calculateEthWillingToPay(withdrawCrabAmount, slippage).then(async (q) => {
        const { minAmountOut } = await getExactIn(weth, usdc, fromTokenAmount(q.ethToGet, 18), fee, slippage)
        setUSDCAmountOutFromWithdraw(toTokenAmount(minAmountOut, USDC_DECIMALS))
        setWithdrawPriceImpact(q.priceImpact)
        setEthAmountInFromWithdraw(q.amountIn)
        setSqueethAmountOutFromWithdraw(q.squeethDebt)
      })
    }
  }, [ready, withdrawCrabAmount.toString(), slippage, network, useUsdc, usdc, weth])

  const onTxnConfirmed = useCallback(() => {
    if (!ongoingTransaction.current) return
    const transaction = ongoingTransaction.current
    if (transaction.queuedTransaction)
      setCrabQueued(crabQueued.plus(fromTokenAmount(transaction.amount, CRAB_TOKEN_DECIMALS)))
    onTxnConfirm({
      status: true,
      amount: transaction.amount,
      tradeType: CrabTradeType.Withdraw,
      transactionType: transaction.queuedTransaction
        ? CrabTradeTransactionType.Queued
        : CrabTradeTransactionType.Instant,
      token: transaction.token,
    })
    transaction.analytics ? recordAnalytics(transaction.analytics) : null
    resetWithdrawAmount()
    resetTracking()
    ongoingTransaction.current = undefined
  }, [setCrabQueued, crabQueued, onTxnConfirm, resetWithdrawAmount, recordAnalytics, resetTracking])

  const withdraw = async () => {
    setTxLoading(true)

    try {
      if (isClaimAndWithdraw) {
        await claimAndWithdrawEth(withdrawAmountBN, slippage)
      } else {
        if (withdrawStep === WithdrawSteps.APPROVE) {
          if (useQueue) {
            await approveQueueCrab(() => resetTransactionData())
          } else {
            await approveCrab(() => resetTransactionData())
          }
        } else {
          const userForceInstantAnalytics = queueOptionAvailable && !useQueue
          ongoingTransaction.current = {
            amount: withdrawAmountBN,
            token: useUsdc ? 'USDC' : 'ETH',
            queuedTransaction: useQueue,
            analytics: userForceInstantAnalytics ? [CRAB_EVENTS.USER_FORCE_INSTANT_WIT_CRAB] : undefined,
          }

          if (useQueue) {
            await queueCRAB(withdrawCrabAmount, onTxnConfirmed)
          } else if (useUsdc) {
            await flashWithdrawUSDC(withdrawCrabAmount, slippage, onTxnConfirmed)
          } else {
            await flashWithdrawEth(withdrawAmountBN, slippage, onTxnConfirmed)
          }
        }
      }
      updateSharesData()
      setStrategyData()
    } catch (e) {
      resetTracking()
      console.log(e)
    }

    setTxLoading(false)
  }

  const handleTokenChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setUseUsdc(event.target.checked)
      resetWithdrawAmount()
    },
    [resetWithdrawAmount],
  )

  const setWithdrawMax = () => {
    if (!useUsdc) setWithdrawAmount(currentEthValue.toString())
    else setWithdrawAmount(currentUsdcValue.toString())
  }

  const depositToken = useMemo(() => (useQueue ? 'USDC' : useUsdc ? 'USDC' : 'ETH'), [useUsdc, useQueue])

  // Update withdraw step
  useEffect(() => {
    if (useQueue) {
      if (crabQueueAllowance.lt(withdrawCrabAmount)) {
        setWithdrawStep(WithdrawSteps.APPROVE)
      } else {
        setWithdrawStep(WithdrawSteps.WITHDRAW)
      }
    } else if (useUsdc) {
      if (crabAllowance.lt(withdrawCrabAmount)) {
        setWithdrawStep(WithdrawSteps.APPROVE)
      } else {
        setWithdrawStep(WithdrawSteps.WITHDRAW)
      }
    } else {
      setWithdrawStep(WithdrawSteps.WITHDRAW)
    }
  }, [useUsdc, crabAllowance, withdrawCrabAmount, crabQueueAllowance, useQueue])

  const minCrabAmount = toTokenAmount(minCrabAmountValue, CRAB_TOKEN_DECIMALS)
  const isWithdrawCrabAmountLessThanMinAllowed = withdrawCrabAmount.lt(minCrabAmount)

  useEffect(() => {
    if (!useUsdc || isNettingAuctionLive || isWithdrawCrabAmountLessThanMinAllowed) {
      setQueueOptionAvailable(false)
      setUseQueue(false)
      return
    }

    if (Number(withdrawPriceImpact) > OTC_PRICE_IMPACT_THRESHOLD) {
      setQueueOptionAvailable(true)
      setUseQueue(true)
    } else {
      setQueueOptionAvailable(false)
      setUseQueue(false)
    }
  }, [withdrawPriceImpact, useUsdc, isNettingAuctionLive, isWithdrawCrabAmountLessThanMinAllowed])

  const withdrawPriceImpactNumber = useQueue ? AVERAGE_AUCTION_PRICE_IMPACT : Number(withdrawPriceImpact)

  const withdrawBtnVariant =
    withdrawPriceImpactNumber > 3 || withdrawFundingWarning || withdrawPriceImpactWarning ? 'outlined' : 'contained'
  const withdrawBtnClassName =
    withdrawPriceImpactNumber > 3
      ? classes.btnDanger
      : withdrawFundingWarning || withdrawPriceImpactWarning
        ? classes.btnWarning
        : ''

  return (
    <>
      <Box marginTop="32px" display="flex" justifyContent="space-between" alignItems="center" gridGap="12px">
        <Typography variant="h4" className={classes.subtitle}>
          Strategy Withdraw
        </Typography>

        <Box className={classes.tokenSelectBox}>
          <Typography variant="caption" className={classes.tokenChoice}>
            ETH
          </Typography>
          <Switch checked={useUsdc} onChange={handleTokenChange} color="primary" name="useUSDC" />
          <Typography variant="caption" className={classes.tokenChoice}>
            USDC
          </Typography>
        </Box>
      </Box>

      <Box display="flex" alignItems="center" gridGap="12px" marginTop="12px">
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
            title={`Standard withdraw helps large withdraws reduce price impact by submitting withdraws via auction. Standard withdraws leave the strategy by Tuesday. Instant withdraws leave the strategy immediately.`}
          >
            <HelpOutlineIcon fontSize="medium" />
          </Tooltip>
        </Box>
      </Box>

      <div className={classes.tradeContainer}>
        <div>
          {isClaimAndWithdraw && currentEthActualValue.gt(0) ? (
            <>
              <Typography variant="caption" component="div">
                Step 1: Withdraw migrated crab position, <b>{migratedCurrentEthValue.toFixed(4)}</b> ETH
              </Typography>
              <Typography variant="caption">
                Step 2: Withdraw crab v2 position, {currentEthActualValue.toFixed(4)} ETH
              </Typography>
            </>
          ) : null}
        </div>

        <InputToken
          id="crab-withdraw-eth-input"
          value={withdrawAmount}
          onInputChange={onInputChange}
          balance={useUsdc ? currentUsdcValue : currentEthValue}
          logo={useUsdc ? usdcLogo : ethLogo}
          symbol={depositToken}
          usdPrice={useUsdc ? new BigNumber(1) : ethIndexPrice}
          onBalanceClick={setWithdrawMax}
          error={!!withdrawError}
          helperText={withdrawError}
        />

        <div className={classes.noticeGray}>
          <div className={classes.infoIconGray}>
            <InfoIcon fontSize="medium" />
          </div>
          <Typography variant="caption" color="textSecondary" className={classes.infoText}>
            Crab aims to earn premium in dollar terms. A crab position reduces ETH holdings when the price of ETH
            increases. It increases ETH holdings when the price of ETH decreases.{' '}
            <a
              className={classes.link}
              href="https://twitter.com/wadepros/status/1580566152844955649?s=20&t=Z4KHUkfbzOfhvauqS7cUwQ"
              target="_blank"
              rel="noreferrer"
            >
              {' '}
              Learn more.{' '}
            </a>
          </Typography>
        </div>

        {withdrawFundingWarning ? (
          <div className={classes.notice}>
            <div className={classes.infoIcon}>
              <Tooltip
                title={
                  'Squeeth is currently more expensive than usual. The strategy buys back squeeth to withdraw. You can still withdraw, but you will pay more.'
                }
              >
                <InfoIcon fontSize="medium" />
              </Tooltip>
            </div>
            <Typography variant="caption" className={classes.infoText}>
              It is currently costly to withdraw. Consider withdrawing later.
            </Typography>
          </div>
        ) : null}

        {withdrawPriceImpactWarning ? (
          <div className={classes.notice}>
            <div className={classes.infoIcon}>
              <Tooltip
                title={
                  'High price impact means that you are losing a significant amount of value due to the size of your trade. Withdrawing a smaller size can reduce your price impact.'
                }
              >
                <InfoIcon fontSize="medium" />
              </Tooltip>
            </div>
            <Typography variant="caption" className={classes.infoText}>
              High price impact. Try smaller amount or{' '}
              {isNettingAuctionLive ? 'wait for auction to be over.' : 'use USDC to queue withdrawal.'}
            </Typography>
          </div>
        ) : null}

        <Box display="flex" flexDirection="column" gridGap="12px" marginTop="24px">
          {useUsdc && !useQueue ? (
            <Metric
              label="Min USDC to receive"
              value={formatNumber(usdcAmountOutFromWithdraw.toNumber()) + ' USDC'}
              isSmall
              flexDirection="row"
              justifyContent="space-between"
              gridGap="12px"
            />
          ) : null}

          <Box display="flex" alignItems="center" justifyContent="space-between" gridGap="12px" flexWrap="wrap">
            {!useQueue && (
              <Metric
                label="Slippage"
                value={formatNumber(slippage) + '%'}
                isSmall
                flexDirection="row"
                justifyContent="space-between"
                gridGap="8px"
              />
            )}

            <Box display="flex" alignItems="center" gridGap="6px" flex="1">
              <Metric
                label={
                  <MetricLabel
                    label={useQueue ? 'Est. Price Impact' : 'Price Impact'}
                    tooltipTitle={
                      useQueue
                        ? `For standard withdraw, the average price impact is ${formatNumber(
                          withdrawPriceImpactNumber,
                        )}% based on historical auctions`
                        : undefined
                    }
                  />
                }
                value={formatNumber(withdrawPriceImpactNumber) + '%'}
                textColor={withdrawPriceImpactNumber > 3 ? 'error' : undefined}
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
          {useQueue && (
            <div className={classes.queueNotice}>
              <Typography variant="subtitle2" color="primary">
                To reduce price impact, your withdrawal may take up until Tuesday to enter the strategy
              </Typography>
            </div>
          )}

          {isRestricted && <RestrictionInfo marginTop="24px" />}

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
                onClick={() => { }}
                disabled={true}
                id="crab-unsupported-network-btn"
              >
                {'Unsupported Network'}
              </PrimaryButtonNew>
            ) : (
              <PrimaryButtonNew
                fullWidth
                id="crab-withdraw-btn"
                variant={withdrawBtnVariant}
                className={withdrawBtnClassName}
                onClick={withdraw}
                disabled={txLoading || !!withdrawError}
              >
                {!txLoading && useQueue && withdrawStep === WithdrawSteps.WITHDRAW ? (
                  <>
                    Standard withdraw
                    <Tooltip
                      title={
                        <div>
                          Your withdrawal will be submitted via auction to reduce price impact. This may take until
                          Tuesday.
                        </div>
                      }
                      style={{ marginLeft: '8' }}
                    >
                      <InfoOutlinedIcon fontSize="small" />
                    </Tooltip>
                  </>
                ) : !txLoading &&
                  (withdrawFundingWarning || withdrawPriceImpactWarning) &&
                  withdrawStep === WithdrawSteps.WITHDRAW ? (
                  'Withdraw anyway'
                ) : !txLoading ? (
                  withdrawStep === WithdrawSteps.APPROVE ? (
                    'Approve strategy to withdraw'
                  ) : (
                    'Withdraw'
                  )
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

export default CrabWithdraw

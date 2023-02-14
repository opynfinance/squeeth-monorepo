import { Box, Typography, Tooltip, CircularProgress } from '@material-ui/core'
import HelpOutlineIcon from '@material-ui/icons/HelpOutline'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'
import BigNumber from 'bignumber.js'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useRef, useState, useMemo } from 'react'
import InfoIcon from '@material-ui/icons/Info'
import debounce from 'lodash/debounce'
import { useEffect } from 'react'

import { PrimaryButtonNew, RoundedButton } from '@components/Button'
import { InputToken } from '@components/InputNew'
import { LinkWrapper } from '@components/LinkWrapper'
import Metric, { MetricLabel } from '@components/Metric'
import RestrictionInfo from '@components/RestrictionInfo'
import { TradeSettings } from '@components/TradeSettings'
import {
  BIG_ZERO,
  FUNDING_PERIOD,
  INDEX_SCALE,
  UNI_POOL_FEES,
  VOL_PERCENT_FIXED,
  VOL_PERCENT_SCALAR,
  WETH_DECIMALS,
  YEAR,
  STRATEGY_DEPOSIT_LIMIT,
  ZENBULL_TOKEN_DECIMALS,
  NETTING_PRICE_IMPACT,
  AVERAGE_AUCTION_PRICE_IMPACT,
} from '@constants/index'
import {
  useGetFlashWithdrawParams,
  useBullFlashWithdraw,
  useQueueWithdrawZenBull,
  useEthToBull,
} from '@state/bull/hooks'
import { impliedVolAtom, indexAtom, normFactorAtom, osqthRefVolAtom } from '@state/controller/atoms'
import { useSelectWallet } from '@state/wallet/hooks'
import { toTokenAmount, fromTokenAmount } from '@utils/calculations'
import { formatNumber } from '@utils/formatter'
import ethLogo from 'public/images/eth-logo.svg'
import { crabStrategySlippageAtomV2 } from '@state/crab/atoms'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import { addressesAtom } from '@state/positions/atoms'
import { useUserAllowance } from '@hooks/contracts/useAllowance'
import { useRestrictUser } from '@context/restrict-user'
import { connectedWalletAtom, supportedNetworkAtom } from '@state/wallet/atoms'
import {
  bullCurrentETHPositionAtom,
  isNettingAuctionLiveAtom,
  minZenBullAmountAtom,
  totalEthQueuedAtom,
  totalZenBullQueuedAtom,
  zenBullQueuedAtom,
} from '@state/bull/atoms'
import useAppMemo from '@hooks/useAppMemo'
import useAppCallback from '@hooks/useAppCallback'
import useAmplitude from '@hooks/useAmplitude'
import { BULL_EVENTS } from '@utils/amplitude'
import useExecuteOnce from '@hooks/useExecuteOnce'
import useTrackTransactionFlow from '@hooks/useTrackTransactionFlow'
import { useZenBullStyles } from './styles'
import { OngoingTransaction, BullTradeType, BullTransactionConfirmation, BullTradeTransactionType } from './types'

enum WithdrawSteps {
  APPROVE = 'Approve ZenBull',
  WITHDRAW = 'Withdraw',
}

const OTC_PRICE_IMPACT_THRESHOLD = Number(process.env.NEXT_PUBLIC_OTC_PRICE_IMPACT_THRESHOLD) || 1

const BullWithdraw: React.FC<{ onTxnConfirm: (txn: BullTransactionConfirmation) => void }> = ({ onTxnConfirm }) => {
  const classes = useZenBullStyles()

  const withdrawAmountRef = useRef('0')
  const ongoingTransactionRef = useRef<OngoingTransaction | undefined>()

  const [withdrawAmount, setWithdrawAmount] = useState('0')
  const withdrawAmountBN = useMemo(() => new BigNumber(withdrawAmount), [withdrawAmount])

  const [slippage, setSlippage] = useAtom(crabStrategySlippageAtomV2)
  const [zenBullQueued, setZenBullQueued] = useAtom(zenBullQueuedAtom)

  const [txLoading, setTxLoading] = useState(false)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [withdrawStep, setWithdrawStep] = useState(WithdrawSteps.WITHDRAW)
  const [queueOptionAvailable, setQueueOptionAvailable] = useState(false)
  const [useQueue, setUseQueue] = useState(false)
  const [userOverrode, setUserOverrode] = useState(false)

  const negativeReturnsError = false
  const connected = useAtomValue(connectedWalletAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const bullPositionValueInEth = useAtomValue(bullCurrentETHPositionAtom)
  const osqthRefVol = useAtomValue(osqthRefVolAtom)
  const isNettingAuctionLive = useAtomValue(isNettingAuctionLiveAtom)
  const minZenBullAmountValue = useAtomValue(minZenBullAmountAtom)
  const totalDepositsQueued = useAtomValue(totalEthQueuedAtom)
  const totalWithdrawsQueued = useAtomValue(totalZenBullQueuedAtom)
  const index = useAtomValue(indexAtom)
  const ethIndexPrice = toTokenAmount(index, 18).sqrt()
  const impliedVol = useAtomValue(impliedVolAtom)
  const normFactor = useAtomValue(normFactorAtom)

  const selectWallet = useSelectWallet()
  const { isRestricted } = useRestrictUser()

  const { bullStrategy, flashBull, bullNetting } = useAtomValue(addressesAtom)
  const { value: bullBalance } = useTokenBalance(bullStrategy, 15, WETH_DECIMALS)
  const { allowance: bullAllowance, approve: approveBull } = useUserAllowance(bullStrategy, flashBull)
  const { allowance: bullQueueAllowance, approve: approveQueueBull } = useUserAllowance(bullStrategy, bullNetting)
  const ethToBull = useEthToBull()

  const [quote, setQuote] = useState({
    maxEthForWPowerPerp: BIG_ZERO,
    maxEthForUsdc: BIG_ZERO,
    wPowerPerpPoolFee: 0,
    usdcPoolFee: 0,
    priceImpact: 0,
    ethInForSqth: BIG_ZERO,
    ethInForUsdc: BIG_ZERO,
    oSqthOut: BIG_ZERO,
    usdcOut: BIG_ZERO,
    poolFee: 0,
  })

  const getFlashBullWithdrawParams = useGetFlashWithdrawParams()
  const bullFlashWithdraw = useBullFlashWithdraw()
  const queueWithdrawZenBull = useQueueWithdrawZenBull()
  const { track } = useAmplitude()
  const logAndRunTransaction = useTrackTransactionFlow()

  const trackUserEnteredWithdrawAmount = useCallback(
    (amount: BigNumber) => track(BULL_EVENTS.WITHDRAW_BULL_AMOUNT_ENTERED, { amount: amount.toNumber() }),
    [track],
  )
  const [trackWithdrawAmountEnteredOnce, resetTracking] = useExecuteOnce(trackUserEnteredWithdrawAmount)

  const withdrawZenBullAmount = useAppMemo(() => {
    return ethToBull(withdrawAmountBN || BIG_ZERO)
  }, [withdrawAmountBN, ethToBull])

  const showPriceImpactWarning = useAppMemo(() => {
    const squeethPrice = quote.ethInForSqth.div(quote.oSqthOut).times(1 - UNI_POOL_FEES / 1000_000)
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
  }, [quote.ethInForSqth, quote.oSqthOut, normFactor, ethIndexPrice, impliedVol])

  const withdrawFundingWarning = useAppMemo(() => {
    const impliedVolDiff = new BigNumber(VOL_PERCENT_SCALAR)
    const impliedVolDiffLowVol = new BigNumber(VOL_PERCENT_FIXED)

    const threshold = BigNumber.max(
      new BigNumber(osqthRefVol / 100).times(new BigNumber(1).plus(impliedVolDiff)),
      new BigNumber(osqthRefVol / 100).plus(impliedVolDiffLowVol),
    )

    const fundingWarning = new BigNumber(impliedVol).gt(threshold) ? true : false
    return fundingWarning
  }, [impliedVol, osqthRefVol])

  const debouncedWithdrawQuote = debounce(async (bullToWithdraw: string) => {
    setQuoteLoading(true)
    getFlashBullWithdrawParams(new BigNumber(bullToWithdraw))
      .then((_quote) => {
        if (bullToWithdraw === withdrawAmountRef.current) {
          let quotePriceImpact = _quote.priceImpact
          if (_quote.poolFee) quotePriceImpact = _quote.priceImpact - _quote.poolFee
          setQuote({ ..._quote, priceImpact: quotePriceImpact })
        }
      })
      .finally(() => {
        if (bullToWithdraw === withdrawAmountRef.current) setQuoteLoading(false)
      })
  }, 500)

  const onInputChange = useAppCallback(
    (ethToWithdraw: string) => {
      const withdrawEthBN = new BigNumber(ethToWithdraw)
      withdrawEthBN.isGreaterThan(0) ? trackWithdrawAmountEnteredOnce(withdrawEthBN) : null
      const _bullToWithdraw = new BigNumber(ethToWithdraw).div(bullPositionValueInEth).times(bullBalance)
      setWithdrawAmount(ethToWithdraw)
      withdrawAmountRef.current = _bullToWithdraw.toString()
      debouncedWithdrawQuote(_bullToWithdraw.toString())
    },
    [trackWithdrawAmountEnteredOnce, debouncedWithdrawQuote, bullBalance, bullPositionValueInEth],
  )

  const onTxnConfirmed = useCallback(
    (id?: string) => {
      if (!ongoingTransactionRef.current) return

      const transaction = ongoingTransactionRef.current
      if (transaction.queuedTransaction) {
        setZenBullQueued(zenBullQueued.plus(fromTokenAmount(transaction.amount, ZENBULL_TOKEN_DECIMALS)))
      }

      onTxnConfirm({
        status: true,
        amount: transaction.amount,
        tradeType: BullTradeType.Withdraw,
        transactionType: transaction.queuedTransaction
          ? BullTradeTransactionType.Queued
          : BullTradeTransactionType.Instant,
        txId: id,
      })
      onInputChange('0')
      resetTracking()
      ongoingTransactionRef.current = undefined
    },
    [onTxnConfirm, resetTracking, onInputChange, zenBullQueued, setZenBullQueued],
  )

  const onApproveClick = async () => {
    setTxLoading(true)
    try {
      if (useQueue) {
        logAndRunTransaction(async () => {
          await approveQueueBull(() => console.log('Approved Standard Bull'))
        }, BULL_EVENTS.APPROVE_WITHDRAW_STN_BULL)
      } else {
        await logAndRunTransaction(async () => {
          await approveBull(() => console.log('Approved Instant Bull'))
        }, BULL_EVENTS.APPROVE_WITHDRAW_BULL)
      }
    } catch (e) {
      console.log(e)
    }
    setTxLoading(false)
  }

  const onWithdrawClick = async () => {
    setTxLoading(true)
    try {
      const bullWithdrawAmount = new BigNumber(withdrawAmountRef.current)
      const ethWithdrawAmount = new BigNumber(withdrawAmount)

      ongoingTransactionRef.current = {
        amount: ethWithdrawAmount,
        queuedTransaction: useQueue,
      }
      const dataToTrack = {
        amount: bullWithdrawAmount,
        isPriceImpactHigh: showPriceImpactWarning,
        priceImpact: quote.poolFee + quote.priceImpact,
      }

      if (useQueue) {
        await queueWithdrawZenBull(bullWithdrawAmount, dataToTrack, onTxnConfirmed)
      } else {
        await bullFlashWithdraw(
          bullWithdrawAmount,
          quote.maxEthForWPowerPerp,
          quote.maxEthForUsdc,
          quote.wPowerPerpPoolFee,
          quote.usdcPoolFee,
          dataToTrack,
          onTxnConfirmed,
        )
      }
    } catch (e) {
      resetTracking()
      console.log(e)
    }

    setTxLoading(false)
  }

  const withdrawError = useAppMemo(() => {
    if (withdrawAmountBN.gt(bullPositionValueInEth)) {
      return 'Withdraw amount greater than strategy balance'
    }
  }, [bullPositionValueInEth, withdrawAmountBN])

  const setWithdrawMax = () => {
    track(BULL_EVENTS.WITHDRAW_BULL_SET_AMOUNT_MAX, {
      amount: bullPositionValueInEth.toNumber(),
    })
    onInputChange(bullPositionValueInEth.toString())
  }

  // Update withdraw step
  useEffect(() => {
    if (useQueue) {
      if (bullQueueAllowance.lt(withdrawZenBullAmount)) {
        setWithdrawStep(WithdrawSteps.APPROVE)
      } else {
        setWithdrawStep(WithdrawSteps.WITHDRAW)
      }
    } else {
      if (bullAllowance.lt(withdrawZenBullAmount)) {
        setWithdrawStep(WithdrawSteps.APPROVE)
      } else {
        setWithdrawStep(WithdrawSteps.WITHDRAW)
      }
    }
  }, [useQueue, bullQueueAllowance, withdrawZenBullAmount, bullAllowance])

  const minZenBullAmount = toTokenAmount(minZenBullAmountValue, ZENBULL_TOKEN_DECIMALS)
  const isWithdrawZenBullLessThanMin = withdrawZenBullAmount.lt(minZenBullAmount)

  useEffect(() => {
    if (isNettingAuctionLive || isWithdrawZenBullLessThanMin) {
      setQueueOptionAvailable(false)
      setUseQueue(false)
      return
    }

    if (quote.priceImpact + quote.poolFee > OTC_PRICE_IMPACT_THRESHOLD) {
      setQueueOptionAvailable(true)
      if (!userOverrode) {
        setUseQueue(true)
      }
    } else {
      setQueueOptionAvailable(false)
      if (!userOverrode) {
        setUseQueue(false)
      }
    }
  }, [isNettingAuctionLive, isWithdrawZenBullLessThanMin, quote.priceImpact, quote.poolFee, userOverrode])

  const withdrawPriceImpactNumber = useAppMemo(() => {
    if (!useQueue) {
      return quote.priceImpact
    }

    const depositsLeft = totalDepositsQueued.minus(totalWithdrawsQueued)
    const depositsLeftAbs = depositsLeft.isNegative() ? new BigNumber(0) : depositsLeft

    const nettingWithdrawAmount = depositsLeftAbs.gt(withdrawAmountBN) ? withdrawAmountBN : depositsLeftAbs
    const remainingWithdraw = withdrawAmountBN.minus(nettingWithdrawAmount)

    const priceImpact = nettingWithdrawAmount
      .times(NETTING_PRICE_IMPACT)
      .plus(remainingWithdraw.times(AVERAGE_AUCTION_PRICE_IMPACT))
      .div(withdrawAmountBN)
      .toNumber()

    return priceImpact
  }, [totalDepositsQueued, totalWithdrawsQueued, useQueue, withdrawAmountBN, quote.priceImpact])

  const onChangeSlippage = useCallback(
    (amount: BigNumber) => {
      track(BULL_EVENTS.WITHDRAW_BULL_CHANGE_SLIPPAGE, { percent: amount.toNumber() })
      setSlippage(amount.toNumber())
      onInputChange(withdrawAmount)
    },
    [withdrawAmount, setSlippage, onInputChange, track],
  )

  const isLoading = txLoading || quoteLoading

  return (
    <>
      <Box marginTop="32px" display="flex" justifyContent="space-between" alignItems="center" gridGap="12px">
        <Typography variant="h3" className={classes.subtitle}>
          Strategy Withdraw
        </Typography>
      </Box>

      <Box display="flex" alignItems="center" gridGap="12px" marginTop="16px">
        <RoundedButton
          disabled={Number(withdrawAmount) >= STRATEGY_DEPOSIT_LIMIT || !Number(withdrawAmount)}
          variant="outlined"
          size="small"
          onClick={() => {
            setUseQueue(false)
            setUserOverrode(true)
          }}
          className={!useQueue ? classes.btnActive : classes.btnDefault}
        >
          Instant
        </RoundedButton>
        <RoundedButton
          disabled={!queueOptionAvailable}
          variant={!queueOptionAvailable ? 'contained' : 'outlined'}
          size="small"
          onClick={() => {
            setUseQueue(true)
            setUserOverrode(true)
          }}
          className={useQueue ? classes.btnActive : classes.btnDefault}
        >
          Standard
        </RoundedButton>
        <Box className={classes.infoIconGray} display="flex" alignItems="center">
          <Tooltip
            title={`Standard reduces price impact and gas costs, exiting the strategy in 24hr on avg or Tuesday latest. Instant exits immediately.`}
          >
            <HelpOutlineIcon fontSize="medium" />
          </Tooltip>
        </Box>
      </Box>

      <div className={classes.tradeContainer}>
        <InputToken
          id="bull-deposit-eth-input"
          value={withdrawAmount}
          onInputChange={onInputChange}
          balance={bullPositionValueInEth}
          logo={ethLogo}
          symbol={'ETH'}
          usdPrice={ethIndexPrice}
          error={!!withdrawError}
          helperText={withdrawError}
          onBalanceClick={setWithdrawMax}
        />

        {negativeReturnsError ? (
          <div className={classes.notice}>
            <div className={classes.infoIcon}>
              <Tooltip title={'Negative returns warning'}>
                <InfoIcon fontSize="medium" />
              </Tooltip>
            </div>
            <Typography variant="caption" className={classes.infoText}>
              Negative returns warning
            </Typography>
          </div>
        ) : null}
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

        {showPriceImpactWarning ? (
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
              High price impact. Try multiple smaller transactions or contact us through{' '}
              <LinkWrapper href="https://tiny.cc/opyndiscord">discord</LinkWrapper> about OTC
            </Typography>
          </div>
        ) : null}

        <Box marginTop="24px">
          <Box display="flex" alignItems="center" justifyContent="space-between" gridGap="12px" flexWrap="wrap">
            <Metric
              isSmall
              label="Uniswap Fee"
              value={formatNumber(quote.poolFee) + '%'}
              flexDirection="row"
              justifyContent="space-between"
              gridGap="8px"
            />

            <Box display="flex" alignItems="center" gridGap="6px" flex="1">
              <Metric
                isSmall
                label={
                  <MetricLabel
                    isSmall
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
                value={formatNumber(quote.priceImpact) + '%'}
                textColor={withdrawPriceImpactNumber > 3 ? 'error' : undefined}
                flexDirection="row"
                justifyContent="space-between"
                gridGap="8px"
              />
              <TradeSettings setSlippage={onChangeSlippage} slippage={new BigNumber(slippage)} />
            </Box>
          </Box>
        </Box>

        {isRestricted && <RestrictionInfo marginTop="24px" />}

        <Box marginTop="24px">
          {isRestricted ? (
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
          ) : withdrawStep === WithdrawSteps.APPROVE ? (
            <PrimaryButtonNew
              fullWidth
              id="bull-approve-btn"
              variant="contained"
              onClick={onApproveClick}
              disabled={quoteLoading || txLoading || !!withdrawError}
            >
              {isLoading ? <CircularProgress color="primary" size="2rem" /> : 'Approve strategy to withdraw'}
            </PrimaryButtonNew>
          ) : (
            <PrimaryButtonNew
              fullWidth
              id="bull-withdraw-btn"
              variant="contained"
              onClick={onWithdrawClick}
              disabled={quoteLoading || txLoading || !!withdrawError}
            >
              {isLoading ? (
                <CircularProgress color="primary" size="2rem" />
              ) : useQueue ? (
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
              ) : (
                'Withdraw'
              )}
            </PrimaryButtonNew>
          )}
        </Box>
      </div>
    </>
  )
}

export default BullWithdraw

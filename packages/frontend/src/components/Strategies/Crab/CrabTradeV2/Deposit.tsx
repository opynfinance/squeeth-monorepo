import { Box, CircularProgress, Switch, Tooltip, Typography } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { useDebounce } from 'use-debounce'
import InfoIcon from '@material-ui/icons/Info'
import { PrimaryButtonNew, RoundedButton } from '@components/Button'
import Confirmed, { ConfirmType } from '@components/Trade/Confirmed'
import { TradeSettings } from '@components/TradeSettings'
import RestrictionInfo from '@components/RestrictionInfo'
import { InputToken } from '@components/InputNew'
import Metric from '@components/Metric'
import { addressAtom, connectedWalletAtom, networkIdAtom, supportedNetworkAtom } from '@state/wallet/atoms'
import { useTransactionStatus, useWalletBalance, useSelectWallet } from '@state/wallet/hooks'
import { crabQueuedAtom, crabStrategySlippageAtomV2, isNettingAuctionLiveAtom, usdcQueuedAtom } from '@state/crab/atoms'
import {
  useSetStrategyDataV2,
  useFlashDepositV2,
  useCalculateETHtoBorrowFromUniswapV2,
  useFlashDepositUSDC,
  useQueueDepositUSDC,
} from '@state/crab/hooks'
import { readyAtom } from '@state/squeethPool/atoms'
import { useUserCrabV2TxHistory } from '@hooks/useUserCrabV2TxHistory'
import { usePrevious } from 'react-use'
import { dailyHistoricalFundingAtom, impliedVolAtom, indexAtom, normFactorAtom } from '@state/controller/atoms'
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
} from '@constants/index'
import { useRestrictUser } from '@context/restrict-user'
import { fromTokenAmount, getUSDCPoolFee, toTokenAmount } from '@utils/calculations'
import { formatNumber } from '@utils/formatter'
import ethLogo from 'public/images/eth-logo.svg'
import usdcLogo from 'public/images/usdc-logo.svg'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'
import HelpOutlineIcon from '@material-ui/icons/HelpOutline'
import { useStyles } from './styles'

type CrabDepositProps = {
  maxCap: BigNumber
  depositedAmount: BigNumber
}

enum DepositSteps {
  APPROVE = 'Approve USDC',
  DEPOSIT = 'Deposit',
}

const OTC_PRICE_IMPACT_THRESHOLD = process.env.OTC_PRICE_IMPACT_THRESHOLD || 1

const CrabDeposit: React.FC<CrabDepositProps> = ({ maxCap, depositedAmount }) => {
  const classes = useStyles()
  const [depositAmount, setDepositAmount, resetDepositAmount] = useStateWithReset('0')
  const [debouncedDepositAmount] = useDebounce(depositAmount, 500)
  const depositAmountBN = useMemo(() => new BigNumber(debouncedDepositAmount), [debouncedDepositAmount])

  const [txLoading, setTxLoading] = useState(false)
  const [depositPriceImpact, setDepositPriceImpact, resetDepositPriceImpact] = useStateWithReset('0')
  const [borrowEth, setBorrowEth, resetBorrowEth] = useStateWithReset(new BigNumber(0))
  const [squeethAmountInFromDeposit, setSqueethAmountInFromDeposit, resetSqueethAmountInFromDeposit] =
    useStateWithReset(new BigNumber(0))
  const [ethAmountOutFromDeposit, setEthAmountOutFromDeposit, resetEthAmountOutFromDeposit] = useStateWithReset(
    new BigNumber(0),
  )
  const [depositEthAmount, setDepositEthAmount] = useState(new BigNumber(0))
  const [useUsdc, setUseUsdc] = useState(true)
  const [useQueue, setUseQueue] = useState(true)
  const [overrideQueueOption, setOverrideQueueOption] = useState(false)
  const [depositStep, setDepositStep] = useState(DepositSteps.DEPOSIT)

  const usdcQueued = useAtomValue(usdcQueuedAtom)
  const crabQueued = useAtomValue(crabQueuedAtom)
  const isNettingAuctionLive = useAtomValue(isNettingAuctionLiveAtom)

  const connected = useAtomValue(connectedWalletAtom)
  const [slippage, setSlippage] = useAtom(crabStrategySlippageAtomV2)
  const network = useAtomValue(networkIdAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const selectWallet = useSelectWallet()

  const { usdc, weth, crabHelper, crabNetting } = useAtomValue(addressesAtom)
  const { data: balance } = useWalletBalance()
  const { value: usdcBalance } = useTokenBalance(usdc, 15, USDC_DECIMALS)
  const { getExactIn } = useUniswapQuoter()
  const setStrategyData = useSetStrategyDataV2()
  const calculateETHtoBorrowFromUniswap = useCalculateETHtoBorrowFromUniswapV2()
  const flashDeposit = useFlashDepositV2(calculateETHtoBorrowFromUniswap)
  const flashDepositUSDC = useFlashDepositUSDC(calculateETHtoBorrowFromUniswap)
  const queueUSDC = useQueueDepositUSDC()
  const index = useAtomValue(indexAtom)
  const ethIndexPrice = toTokenAmount(index, 18).sqrt()

  const { confirmed, resetTransactionData, transactionData } = useTransactionStatus()

  const ready = useAtomValue(readyAtom)
  const { isRestricted } = useRestrictUser()

  const dailyHistoricalFunding = useAtomValue(dailyHistoricalFundingAtom)

  const address = useAtomValue(addressAtom)
  const { allowance: usdcAllowance, approve: approveUsdc } = useUserAllowance(usdc, crabHelper, USDC_DECIMALS)
  const { allowance: usdcQueueAllowance, approve: approveQueueUsdc } = useUserAllowance(
    usdc,
    crabNetting,
    USDC_DECIMALS,
  )
  const { data, startPolling, stopPolling } = useUserCrabV2TxHistory(address ?? '')

  const prevCrabTxData = usePrevious(data)

  const impliedVol = useAtomValue(impliedVolAtom)
  const normFactor = useAtomValue(normFactorAtom)

  useEffect(() => {
    if (confirmed && prevCrabTxData?.length === data?.length) {
      startPolling(500)
    } else {
      stopPolling()
    }
  }, [confirmed, prevCrabTxData?.length, data?.length])

  const depositPriceImpactWarning = useAppMemo(() => {
    if (useQueue) return false

    const squeethPrice = ethAmountOutFromDeposit.div(squeethAmountInFromDeposit)
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
  }, [impliedVol, ethAmountOutFromDeposit, squeethAmountInFromDeposit, useQueue, ethIndexPrice, normFactor])

  const depositFundingWarning = useAppMemo(() => {
    const impliedVolDiff = new BigNumber(-VOL_PERCENT_SCALAR)
    const impliedVolDiffLowVol = new BigNumber(-VOL_PERCENT_FIXED)
    const dailyHistoricalImpliedVol = new BigNumber(dailyHistoricalFunding.funding).times(YEAR).sqrt()
    const threshold = BigNumber.max(
      dailyHistoricalImpliedVol.times(new BigNumber(1).plus(impliedVolDiff)),
      dailyHistoricalImpliedVol.plus(impliedVolDiffLowVol),
    )

    const showFundingWarning = new BigNumber(impliedVol).lt(threshold) ? true : false
    return showFundingWarning
  }, [dailyHistoricalFunding.funding, impliedVol])

  const depositError = useAppMemo(() => {
    let inputError

    if (connected) {
      if (depositEthAmount.plus(depositedAmount).gte(maxCap)) {
        inputError = 'Amount greater than strategy cap'
      } else if (depositEthAmount.plus(depositedAmount).plus(borrowEth).gte(maxCap)) {
        inputError = `Amount greater than strategy cap since it flash borrows ${borrowEth.toFixed(
          2,
        )} ETH. Input a smaller amount`
      } else if (!useUsdc && toTokenAmount(balance ?? BIG_ZERO, 18).lt(depositAmountBN)) {
        inputError = 'Insufficient ETH balance'
      } else if (useUsdc && usdcBalance.lt(depositAmountBN)) {
        inputError = 'Insufficient USDC balance'
      }
    }

    return inputError
  }, [connected, depositEthAmount, depositAmountBN, depositedAmount, maxCap, borrowEth, usdcBalance, balance, useUsdc])

  useEffect(() => {
    if (!ready) {
      return
    }

    if (depositAmountBN.isZero()) {
      resetDepositPriceImpact()
      resetBorrowEth()
      resetEthAmountOutFromDeposit()
      resetSqueethAmountInFromDeposit()
      return
    }

    if (!useUsdc) {
      setDepositEthAmount(depositAmountBN)
      calculateETHtoBorrowFromUniswap(depositAmountBN, slippage).then((q) => {
        setDepositPriceImpact(q.priceImpact)
        setBorrowEth(q.ethBorrow)
        setEthAmountOutFromDeposit(q.amountOut)
        setSqueethAmountInFromDeposit(q.initialWSqueethDebt)
      })
    } else {
      const fee = getUSDCPoolFee(network)
      getExactIn(usdc, weth, fromTokenAmount(depositAmountBN, USDC_DECIMALS), fee, slippage).then((usdcq) => {
        setDepositEthAmount(toTokenAmount(usdcq.amountOut, WETH_DECIMALS))
        calculateETHtoBorrowFromUniswap(toTokenAmount(usdcq.minAmountOut, WETH_DECIMALS), slippage).then((q) => {
          setDepositPriceImpact(q.priceImpact)
          setBorrowEth(q.ethBorrow)
          setEthAmountOutFromDeposit(q.amountOut)
          setSqueethAmountInFromDeposit(q.initialWSqueethDebt)
        })
      })
    }
  }, [ready, depositAmountBN.toString(), slippage, useUsdc, network, usdc, weth])

  const depositTX = async (overrideQueue = false) => {
    const isQueue = !overrideQueue && useQueue
    setTxLoading(true)

    try {
      if (depositStep === DepositSteps.APPROVE) {
        if (isQueue) {
          await approveQueueUsdc(() => resetTransactionData())
        } else {
          await approveUsdc(() => resetTransactionData())
        }
      } else {
        if (isQueue) {
          await queueUSDC(depositAmountBN)
        } else if (useUsdc) {
          await flashDepositUSDC(depositAmountBN, slippage, () => {
            setStrategyData()
          })
        } else {
          await flashDeposit(depositAmountBN, slippage, () => {
            setStrategyData()
          })
        }
      }
    } catch (e) {
      console.log(e)
      setTxLoading(false)
    }
    setTxLoading(false)
  }

  const handleTokenChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setUseUsdc(event.target.checked)
      resetDepositAmount()
    },
    [resetDepositAmount],
  )

  const setDepositMax = () => {
    if (!useUsdc) setDepositAmount(toTokenAmount(balance ?? BIG_ZERO, 18).toString())
    else setDepositAmount(usdcBalance.toString())
  }

  const depositToken = useMemo(() => (useQueue ? 'USDC' : useUsdc ? 'USDC' : 'ETH'), [useUsdc, useQueue])

  // Update deposit step
  useEffect(() => {
    if (useQueue) {
      if (usdcQueueAllowance.lt(depositAmountBN)) {
        setDepositStep(DepositSteps.APPROVE)
      } else {
        setDepositStep(DepositSteps.DEPOSIT)
      }
    } else if (useUsdc) {
      if (usdcAllowance.lt(depositAmountBN)) {
        setDepositStep(DepositSteps.APPROVE)
      } else {
        setDepositStep(DepositSteps.DEPOSIT)
      }
    } else {
      setDepositStep(DepositSteps.DEPOSIT)
    }
  }, [useUsdc, usdcAllowance, depositAmountBN, useQueue, usdcQueueAllowance])

  useEffect(() => {
    if (!useUsdc || isNettingAuctionLive) {
      setUseQueue(false)
      return
    }

    if (Number(depositPriceImpact) > OTC_PRICE_IMPACT_THRESHOLD) {
      setUseQueue(true)
      setOverrideQueueOption(false)
    } else {
      setUseQueue(false)
      setOverrideQueueOption(true)
    }
  }, [depositPriceImpact, useUsdc, isNettingAuctionLive])

  const confirmationMessage = useAppMemo(() => {
    if (useQueue && !overrideQueueOption) {
      return `Queued ${depositAmountBN.toFixed(4)} ${depositToken} for deposit`
    }
    return `Deposited ${depositAmountBN.toFixed(4)} ${depositToken}`
  }, [depositAmountBN, depositToken, useQueue, overrideQueueOption])

  const setOverrideOption = (option: boolean) => {
    setOverrideQueueOption(option)
  }

  const depositPriceImpactNumber = Number(depositPriceImpact)

  const depositBtnVariant =
    Number(depositPriceImpact) > 3 || depositFundingWarning || depositPriceImpactWarning ? 'outlined' : 'contained'
  const depositBtnClassName =
    Number(depositPriceImpact) > 3
      ? classes.dangerBtn
      : depositFundingWarning || depositPriceImpactWarning
      ? classes.warningBtn
      : ''

  return (
    <>
      {confirmed ? (
        <>
          <Confirmed
            confirmationMessage={confirmationMessage}
            txnHash={transactionData?.hash ?? ''}
            confirmType={ConfirmType.CRAB}
          />
          <PrimaryButtonNew
            fullWidth
            id="crab-close-btn"
            variant="contained"
            onClick={() => {
              resetTransactionData()
              resetDepositAmount()
            }}
          >
            Close
          </PrimaryButtonNew>
        </>
      ) : (
        <>
          <Box display="flex" justifyContent="space-between" alignItems="center" gridGap="12px">
            <Typography variant="h4" className={classes.subtitle}>
              Strategy Deposit
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

          <Box display="flex" alignItems="center" gridGap="12px" marginTop="8px">
            <RoundedButton
              style={{ borderRadius: '20px' }}
              variant="outlined"
              color={overrideQueueOption || !useQueue ? 'primary' : 'default'}
              size="small"
              onClick={() => setOverrideOption(true)}
            >
              <Typography color={overrideQueueOption || !useQueue ? 'primary' : 'textSecondary'}>Instant</Typography>
            </RoundedButton>
            <RoundedButton
              disabled={!useQueue}
              style={{ borderRadius: '20px' }}
              variant={!useQueue ? 'contained' : 'outlined'}
              color={!overrideQueueOption ? 'primary' : 'default'}
              size="small"
              onClick={() => setOverrideOption(false)}
            >
              <Typography color={!overrideQueueOption ? 'primary' : 'textSecondary'}>Standard</Typography>
            </RoundedButton>
            <Box className={classes.infoIconGray}>
              <Tooltip
                title={`With standard, the deposit gets initiated and is submitted via auction to avoid price impact. This may take up until Tuesday.`}
              >
                <HelpOutlineIcon fontSize="medium" />
              </Tooltip>
            </Box>
          </Box>

          <div className={classes.tradeContainer}>
            <InputToken
              id="crab-deposit-eth-input"
              value={depositAmount}
              onInputChange={setDepositAmount}
              balance={useUsdc ? usdcBalance : toTokenAmount(balance ?? BIG_ZERO, 18)}
              logo={useUsdc ? usdcLogo : ethLogo}
              symbol={useUsdc ? 'USDC' : 'ETH'}
              usdPrice={useUsdc ? new BigNumber(1) : ethIndexPrice}
              onBalanceClick={setDepositMax}
              error={!!depositError}
              helperText={depositError}
            />

            <div className={classes.noticeGray}>
              <div className={classes.infoIconGray}>
                <InfoIcon fontSize="medium" />
              </div>
              <Typography variant="caption" color="textSecondary" className={classes.infoText}>
                Crab aims to earn yield in dollar terms. A crab position reduces ETH holdings when the price of ETH
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

            {depositFundingWarning && (
              <div className={classes.notice}>
                <div className={classes.infoIcon}>
                  <Tooltip
                    title={
                      'The strategy sells squeeth to earn yield. Yield is currently lower than usual. You can still deposit, but you may be more likely to have negative returns.'
                    }
                  >
                    <InfoIcon fontSize="medium" />
                  </Tooltip>
                </div>
                <Typography variant="caption" className={classes.infoText}>
                  Crab yield is currently lower than usual. Consider depositing later.
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
                  High price impact. Try smaller amount or{' '}
                  {isNettingAuctionLive ? 'wait for auction to be over.' : 'use USDC to queue deposit.'}
                </Typography>
              </div>
            )}

            <Box display="flex" flexDirection="column" gridGap="12px" marginTop="24px">
              <Box display="flex" alignItems="center" justifyContent="space-between" gridGap="12px" flexWrap="wrap">
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
                    value={formatNumber(depositPriceImpactNumber) + '%'}
                    textColor={
                      depositPriceImpactNumber > 3 ? 'error' : depositPriceImpactNumber < 1 ? 'success' : undefined
                    }
                    isSmall
                    flexDirection="row"
                    justifyContent="space-between"
                    gridGap="12px"
                  />

                  <TradeSettings
                    isCrab={true}
                    setCrabSlippage={(s) => setSlippage(s.toNumber())}
                    crabSlippage={new BigNumber(slippage)}
                  />
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
                  onClick={() => depositTX(overrideQueueOption)}
                  disabled={txLoading || !!depositError}
                >
                  {!txLoading && useQueue && depositStep === DepositSteps.DEPOSIT && !overrideQueueOption ? (
                    <>
                      Queue to avoid price impact
                      <Tooltip
                        title={
                          <div>
                            Your deposit will be submitted via auction to avoid price impact. This may take until
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
            </Box>
          </div>
          {crabQueued.isGreaterThan(0) || usdcQueued.isGreaterThan(0) ? (
            <div className={classes.queueNotice}>
              {usdcQueued.isGreaterThan(0)
                ? 'Your deposit will fully enter the strategy by Tuesday'
                : 'Your withdrawal will fully exit the strategy by Tuesday'}
            </div>
          ) : null}
        </>
      )}
    </>
  )
}

export default CrabDeposit

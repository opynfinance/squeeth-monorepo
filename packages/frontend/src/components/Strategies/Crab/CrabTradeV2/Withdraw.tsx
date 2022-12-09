import { Box, CircularProgress, Switch, Tooltip, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
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
import { useTransactionStatus, useSelectWallet } from '@state/wallet/hooks'
import {
  crabQueuedAtom,
  crabStrategySlippageAtomV2,
  currentCrabPositionETHActualAtomV2,
  currentCrabPositionValueAtomV2,
  isNettingAuctionLiveAtom,
  usdcQueuedAtom,
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
} from '@constants/index'
import { useRestrictUser } from '@context/restrict-user'
import { fromTokenAmount, getUSDCPoolFee, toTokenAmount } from '@utils/calculations'
import { formatNumber } from '@utils/formatter'
import ethLogo from 'public/images/eth-logo.svg'
import usdcLogo from 'public/images/usdc-logo.svg'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'
import HelpOutlineIcon from '@material-ui/icons/HelpOutline'

const useStyles = makeStyles((theme) =>
  createStyles({
    link: {
      color: theme.palette.primary.main,
    },
    tradeContainer: {
      display: 'flex',
      flexDirection: 'column',
    },
    notice: {
      marginTop: theme.spacing(2.5),
      padding: theme.spacing(2),
      border: `1px solid #F3FF6C`,
      borderRadius: theme.spacing(1),
      display: 'flex',
      background: 'rgba(243, 255, 108, 0.1)',
      alignItems: 'center',
    },
    infoIcon: {
      marginRight: theme.spacing(2),
      color: '#F3FF6C',
    },
    noticeGray: {
      marginTop: theme.spacing(2.5),
      padding: theme.spacing(2.5),
      border: `1px solid ${theme.palette.background.stone}`,
      borderRadius: theme.spacing(1),
      display: 'flex',
      background: theme.palette.background.lightStone,
      alignItems: 'center',
    },
    infoIconGray: {
      marginRight: theme.spacing(2),
      color: theme.palette.text.hint,
    },
    tokenSelectBox: {
      display: 'flex',
      alignItems: 'center',
    },
    tokenChoice: {
      fontWeight: 500,
    },
    subtitle: {
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    infoText: {
      fontWeight: 500,
      fontSize: '13px',
    },
    queueNotice: {
      background: theme.palette.background.stone,
      borderRadius: theme.spacing(1.5),
      padding: theme.spacing(2),
      color: theme.palette.primary.main,
      marginTop: theme.spacing(2),
    },
  }),
)

enum WithdrawSteps {
  APPROVE = 'Approve CRAB',
  WITHDRAW = 'Withdraw',
}

const OTC_PRICE_IMPACT_THRESHOLD = process.env.OTC_PRICE_IMPACT_THRESHOLD || 1

const CrabWithdraw: React.FC = () => {
  const classes = useStyles()
  const [withdrawAmount, setWithdrawAmount, resetWithdrawAmount] = useStateWithReset('0')
  const [debouncedWithdrawAmount] = useDebounce(withdrawAmount, 500)
  const withdrawAmountBN = useMemo(() => new BigNumber(debouncedWithdrawAmount), [debouncedWithdrawAmount])

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
  const [useQueue, setUseQueue] = useState(true)
  const [overrideQueueOption, setOverrideQueueOption] = useState(false)
  const [withdrawStep, setWithdrawStep] = useState(WithdrawSteps.WITHDRAW)

  const usdcQueued = useAtomValue(usdcQueuedAtom)
  const crabQueued = useAtomValue(crabQueuedAtom)
  const isNettingAuctionLive = useAtomValue(isNettingAuctionLiveAtom)

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
  const index = useAtomValue(indexAtom)
  const ethIndexPrice = toTokenAmount(index, 18).sqrt()

  const { confirmed, resetTransactionData, transactionData } = useTransactionStatus()

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

  const withdraw = async (overrideQueue = false) => {
    const isQueue = !overrideQueue && useQueue
    setTxLoading(true)

    try {
      if (isClaimAndWithdraw) {
        await claimAndWithdrawEth(withdrawAmountBN, slippage)
      } else {
        if (withdrawStep === WithdrawSteps.APPROVE) {
          if (isQueue) {
            await approveQueueCrab(() => resetTransactionData())
          } else {
            await approveCrab(() => resetTransactionData())
          }
        } else {
          if (isQueue) {
            await queueCRAB(withdrawCrabAmount)
          } else if (useUsdc) {
            await flashWithdrawUSDC(withdrawCrabAmount, slippage)
          } else {
            await flashWithdrawEth(withdrawAmountBN, slippage)
          }
        }
      }
      updateSharesData()
      setStrategyData()
    } catch (e) {
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

  useEffect(() => {
    if (!useUsdc || isNettingAuctionLive) {
      setUseQueue(false)
      return
    }

    if (Number(withdrawPriceImpact) > OTC_PRICE_IMPACT_THRESHOLD) {
      setUseQueue(true)
      setOverrideQueueOption(false)
    } else {
      setUseQueue(false)
      setOverrideQueueOption(true)
    }
  }, [withdrawPriceImpact, useUsdc, isNettingAuctionLive])

  const confirmationMessage = useAppMemo(() => {
    if (useQueue && !overrideQueueOption) {
      return `Queued ${withdrawAmountBN.toFixed(4)} ${depositToken} for withdrawal`
    }
    return `Withdrawn ${withdrawAmountBN.toFixed(4)} ${depositToken}`
  }, [useQueue, withdrawAmountBN, overrideQueueOption, depositToken])

  const setOverrideOption = (option: boolean) => {
    setOverrideQueueOption(option)
  }

  const withdrawPriceImpactNumber = Number(withdrawPriceImpact)

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
              resetWithdrawAmount()
            }}
          >
            Close
          </PrimaryButtonNew>
        </>
      ) : (
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
                title={`With standard, the withdraw gets initiated and is submitted via auction to avoid price impact. This may take up until Tuesday.`}
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
              onInputChange={setWithdrawAmount}
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
              {useUsdc ? (
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
                    value={formatNumber(withdrawPriceImpactNumber) + '%'}
                    textColor={
                      withdrawPriceImpactNumber > 3 ? 'error' : withdrawPriceImpactNumber < 1 ? 'success' : undefined
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
                  id="crab-withdraw-btn"
                  variant={
                    Number(withdrawPriceImpact) > 3 || withdrawFundingWarning || withdrawPriceImpactWarning
                      ? 'outlined'
                      : 'contained'
                  }
                  style={
                    Number(withdrawPriceImpact) > 3
                      ? { color: '#f5475c', backgroundColor: 'transparent', borderColor: '#f5475c', marginTop: '8px' }
                      : withdrawFundingWarning || withdrawPriceImpactWarning
                      ? { color: '#F3FF6C', backgroundColor: 'transparent', borderColor: '#F3FF6C', marginTop: '8px' }
                      : { marginTop: '8px' }
                  }
                  onClick={() => withdraw(overrideQueueOption)}
                  disabled={txLoading || !!withdrawError}
                >
                  {!txLoading && useQueue && withdrawStep === WithdrawSteps.WITHDRAW && !overrideQueueOption ? (
                    <>
                      Queue to avoid price impact
                      <Tooltip
                        title={
                          <div>
                            Your withdrawal will be submitted via auction to avoid price impact. This may take until
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
                    withdrawStep
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

export default CrabWithdraw

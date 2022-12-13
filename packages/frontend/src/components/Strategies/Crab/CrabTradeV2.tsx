import { Box, CircularProgress, Switch, Tooltip, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import BigNumber from 'bignumber.js'
import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import InfoIcon from '@material-ui/icons/Info'
import { usePrevious } from 'react-use'

import { PrimaryButtonNew } from '@components/Button'
import { SqueethTabsNew, SqueethTabNew } from '@components/Tabs'
import Confirmed, { ConfirmType } from '@components/Trade/Confirmed'
import { TradeSettings } from '@components/TradeSettings'
import RestrictionInfo from '@components/RestrictionInfo'
import { InputToken } from '@components/InputNew'
import { LinkWrapper } from '@components/LinkWrapper'
import Metric from '@components/Metric'
import { addressAtom, connectedWalletAtom, networkIdAtom, supportedNetworkAtom } from '@state/wallet/atoms'
import { useTransactionStatus, useWalletBalance, useSelectWallet } from '@state/wallet/hooks'
import {
  crabStrategySlippageAtomV2,
  currentCrabPositionETHActualAtomV2,
  currentCrabPositionValueAtomV2,
} from '@state/crab/atoms'
import {
  useSetStrategyDataV2,
  useFlashDepositV2,
  useCalculateETHtoBorrowFromUniswapV2,
  useFlashWithdrawEthV2,
  useCalculateEthWillingToPayV2,
  useClaimAndWithdrawEthV2,
  useFlashDepositUSDC,
  useETHtoCrab,
  useFlashWithdrawV2USDC,
} from '@state/crab/hooks'
import { readyAtom } from '@state/squeethPool/atoms'
import {
  currentImpliedFundingAtom,
  dailyHistoricalFundingAtom,
  impliedVolAtom,
  indexAtom,
  normFactorAtom,
} from '@state/controller/atoms'
import { addressesAtom } from '@state/positions/atoms'
import { userMigratedSharesETHAtom } from '@state/crabMigration/atom'
import { useUpdateSharesData } from '@state/crabMigration/hooks'
import { useUserCrabV2TxHistory } from '@hooks/useUserCrabV2TxHistory'
import useAppMemo from '@hooks/useAppMemo'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import { useUniswapQuoter } from '@hooks/useUniswapQuoter'
import { useUserAllowance } from '@hooks/contracts/useAllowance'
import useAppEffect from '@hooks/useAppEffect'
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

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(2),
    },
    confirmedBox: {
      display: 'flex',
      justifyContent: 'center',
      textAlign: 'center',
      flexDirection: 'column',
      padding: theme.spacing(2, 3),
    },
    link: {
      color: theme.palette.primary.main,
    },
    settingsButton: {
      display: 'flex',
      marginTop: theme.spacing(0.5),
      padding: theme.spacing(0, 3),
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    tradeContainer: {
      display: 'flex',
      flexDirection: 'column',
    },
    tabBackGround: {
      position: 'sticky',
      top: '0',
      zIndex: 20,
      // background: '#2A2D2E',
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
  }),
)

type CrabTradeV2Type = {
  maxCap: BigNumber
  depositedAmount: BigNumber
}

enum DepositSteps {
  APPROVE = 'Approve USDC',
  DEPOSIT = 'Deposit',
}

enum WithdrawSteps {
  APPROVE = 'Approve CRAB',
  WITHDRAW = 'Withdraw',
}

const CrabTradeV2: React.FC<CrabTradeV2Type> = ({ maxCap, depositedAmount }) => {
  const classes = useStyles()
  const [depositAmount, setDepositAmount, resetDepositAmount] = useStateWithReset('0')
  const [withdrawAmount, setWithdrawAmount, resetWithdrawAmount] = useStateWithReset('0')
  const [depositOption, setDepositOption] = useState(0)
  const [txLoading, setTxLoading] = useState(false)
  const [depositPriceImpact, setDepositPriceImpact, resetDepositPriceImpact] = useStateWithReset('0')
  const [withdrawPriceImpact, setWithdrawPriceImpact, resetWithdrawPriceImpact] = useStateWithReset('0')
  const [borrowEth, setBorrowEth, resetBorrowEth] = useStateWithReset(new BigNumber(0))
  const [squeethAmountInFromDeposit, setSqueethAmountInFromDeposit, resetSqueethAmountInFromDeposit] =
    useStateWithReset(new BigNumber(0))
  const [ethAmountOutFromDeposit, setEthAmountOutFromDeposit, resetEthAmountOutFromDeposit] = useStateWithReset(
    new BigNumber(0),
  )
  const [ethAmountInFromWithdraw, setEthAmountInFromWithdraw, resetEthAmountInFromWithdraw] = useStateWithReset(
    new BigNumber(0),
  )
  const [usdcAmountOutFromWithdraw, setUSDCAmountOutFromWithdraw, resetUSDCAmountOutFromWithdraw] = useStateWithReset(
    new BigNumber(0),
  )
  const [squeethAmountOutFromWithdraw, setSqueethAmountOutFromWithdraw, resetSqueethAmountOutFromWithdraw] =
    useStateWithReset(new BigNumber(0))
  const [depositEthAmount, setDepositEthAmount] = useState(new BigNumber(0))
  const [useUsdc, setUseUsdc] = useState(true)
  const [depositStep, setDepositStep] = useState(DepositSteps.DEPOSIT)
  const [withdrawStep, setWithdrawStep] = useState(WithdrawSteps.WITHDRAW)

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

  const depositAmountBN = useMemo(() => new BigNumber(depositAmount), [depositAmount])
  const withdrawAmountBN = useMemo(() => new BigNumber(withdrawAmount), [withdrawAmount])

  const { usdc, weth, crabHelper, crabStrategy2 } = useAtomValue(addressesAtom)
  const { data: balance } = useWalletBalance()
  const { value: usdcBalance } = useTokenBalance(usdc, 15, USDC_DECIMALS)
  const { getExactIn } = useUniswapQuoter()
  const setStrategyData = useSetStrategyDataV2()
  const flashWithdrawEth = useFlashWithdrawEthV2()
  const claimAndWithdrawEth = useClaimAndWithdrawEthV2()
  const calculateEthWillingToPay = useCalculateEthWillingToPayV2()
  const calculateETHtoBorrowFromUniswap = useCalculateETHtoBorrowFromUniswapV2()
  const updateSharesData = useUpdateSharesData()
  const flashDeposit = useFlashDepositV2(calculateETHtoBorrowFromUniswap)
  const flashDepositUSDC = useFlashDepositUSDC(calculateETHtoBorrowFromUniswap)
  const flashWithdrawUSDC = useFlashWithdrawV2USDC()
  const getUserCrabForEthAmount = useETHtoCrab()
  const index = useAtomValue(indexAtom)
  const ethIndexPrice = toTokenAmount(index, 18).sqrt()

  const { confirmed, resetTransactionData, transactionData } = useTransactionStatus()

  const ready = useAtomValue(readyAtom)
  const { isRestricted } = useRestrictUser()

  const dailyHistoricalFunding = useAtomValue(dailyHistoricalFundingAtom)
  const currentImpliedFunding = useAtomValue(currentImpliedFundingAtom)

  const address = useAtomValue(addressAtom)
  const { allowance: usdcAllowance, approve: approveUsdc } = useUserAllowance(usdc, crabHelper, USDC_DECIMALS)
  const { allowance: crabAllowance, approve: approveCrab } = useUserAllowance(crabStrategy2, crabHelper)
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

  useEffect(() => {
    setStrategyData()
  }, [])

  const { depositPriceImpactWarning, withdrawPriceImpactWarning } = useAppMemo(() => {
    let depositPriceImpactWarning: Boolean | false
    let withdrawPriceImpactWarning: Boolean | false

    const squeethPrice =
      depositOption === 0
        ? ethAmountOutFromDeposit.div(squeethAmountInFromDeposit)
        : ethAmountInFromWithdraw.div(squeethAmountOutFromWithdraw)
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
    depositPriceImpactWarning = showPriceImpactWarning && depositOption === 0 ? true : false
    withdrawPriceImpactWarning = showPriceImpactWarning && depositOption !== 0 ? true : false
    return { depositPriceImpactWarning, withdrawPriceImpactWarning }
  }, [
    dailyHistoricalFunding.funding,
    dailyHistoricalFunding.period,
    impliedVol,
    ethAmountOutFromDeposit,
    squeethAmountInFromDeposit,
    ethAmountInFromWithdraw,
    squeethAmountOutFromWithdraw,
    depositOption,
  ])

  const { depositFundingWarning, withdrawFundingWarning } = useAppMemo(() => {
    let depositFundingWarning: Boolean | false
    let withdrawFundingWarning: Boolean | false

    const impliedVolDiff = new BigNumber(depositOption === 0 ? -VOL_PERCENT_SCALAR : VOL_PERCENT_SCALAR)
    const impliedVolDiffLowVol = new BigNumber(depositOption === 0 ? -VOL_PERCENT_FIXED : VOL_PERCENT_FIXED)
    const dailyHistoricalImpliedVol = new BigNumber(dailyHistoricalFunding.funding).times(YEAR).sqrt()
    const threshold = BigNumber.max(
      dailyHistoricalImpliedVol.times(new BigNumber(1).plus(impliedVolDiff)),
      dailyHistoricalImpliedVol.plus(impliedVolDiffLowVol),
    )
    depositFundingWarning = depositOption === 0 && new BigNumber(impliedVol).lt(threshold) ? true : false
    withdrawFundingWarning = depositOption != 0 && new BigNumber(impliedVol).gt(threshold) ? true : false
    return { depositFundingWarning, withdrawFundingWarning }
  }, [dailyHistoricalFunding.funding, dailyHistoricalFunding.period, depositOption, impliedVol])

  const { depositError, warning, withdrawError } = useAppMemo(() => {
    let depositError: string | undefined
    let withdrawError: string | undefined
    let warning: string | undefined

    if (connected) {
      if (depositEthAmount.plus(depositedAmount).gte(maxCap)) {
        depositError = 'Amount greater than strategy cap'
      } else if (depositEthAmount.plus(depositedAmount).plus(borrowEth).gte(maxCap)) {
        depositError = `Amount greater than strategy cap since it flash borrows ${borrowEth.toFixed(
          2,
        )} ETH. Input a smaller amount`
      } else if (!useUsdc && toTokenAmount(balance ?? BIG_ZERO, 18).lt(depositAmountBN)) {
        depositError = 'Insufficient ETH balance'
      } else if (useUsdc && usdcBalance.lt(depositAmountBN)) {
        depositError = 'Insufficient USDC balance'
      }
      if (!useUsdc && withdrawAmountBN.gt(currentEthValue)) {
        withdrawError = 'Withdraw amount greater than strategy balance'
      } else if (useUsdc && withdrawAmountBN.gt(currentUsdcValue)) {
        withdrawError = 'Withdraw amount greater than strategy balance'
      }
    }

    return { depositError, warning, withdrawError }
  }, [
    connected,
    depositEthAmount.toString(),
    depositAmountBN.toString(),
    depositedAmount.toString(),
    maxCap.toString(),
    borrowEth.toString(),
    balance?.toString(),
    withdrawAmountBN.toString(),
    currentEthValue.toString(),
    currentUsdcValue.toString(),
    currentImpliedFunding.toString(),
    dailyHistoricalFunding.funding,
    dailyHistoricalFunding.period,
    useUsdc,
  ])

  const withdrawEthAmount = useAppMemo(() => {
    if (!useUsdc) return withdrawAmountBN
    else {
      if (currentUsdcValue.isZero()) {
        return BIG_ZERO
      }
      return withdrawAmountBN.div(currentUsdcValue).times(currentEthValue)
    }
  }, [withdrawAmountBN, useUsdc, currentUsdcValue, currentEthValue])

  const withdrawCrabAmount = useAppMemo(() => {
    return getUserCrabForEthAmount(withdrawEthAmount || BIG_ZERO)
  }, [withdrawEthAmount])

  useEffect(() => {
    if (!ready || depositOption !== 0) {
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
  }, [ready, depositAmountBN.toString(), slippage, useUsdc])

  useEffect(() => {
    if (!ready || depositOption === 0) {
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
        const { minAmountOut, amountOut } = await getExactIn(weth, usdc, fromTokenAmount(q.ethToGet, 18), fee, slippage)
        setUSDCAmountOutFromWithdraw(toTokenAmount(minAmountOut, USDC_DECIMALS))
        setWithdrawPriceImpact(q.priceImpact)
        setEthAmountInFromWithdraw(q.amountIn)
        setSqueethAmountOutFromWithdraw(q.squeethDebt)
      })
    }
  }, [ready, withdrawCrabAmount.toString(), slippage])

  const depositTX = async () => {
    setTxLoading(true)
    try {
      console.log('USDC: In usdc check')
      if (depositStep === DepositSteps.APPROVE) {
        await approveUsdc(() => resetTransactionData())
      } else {
        if (useUsdc) {
          console.log('USDC: going to flash deposit')
          await flashDepositUSDC(depositAmountBN, slippage, () => {
            setStrategyData()
          })
        } else {
          await flashDeposit(depositAmountBN, slippage, () => {
            setStrategyData()
          })
        }
      }
      setTxLoading(false)
    } catch (e) {
      console.log(e)
      setTxLoading(false)
    }
  }

  const withdraw = async () => {
    setTxLoading(true)
    try {
      if (isClaimAndWithdraw) {
        await claimAndWithdrawEth(withdrawAmountBN, slippage)
      } else {
        if (withdrawStep === WithdrawSteps.APPROVE) {
          await approveCrab(() => resetTransactionData())
        } else {
          if (useUsdc) {
            await flashWithdrawUSDC(withdrawCrabAmount, slippage)
          } else {
            await flashWithdrawEth(withdrawAmountBN, slippage)
          }
        }
      }
      updateSharesData()
      setTxLoading(false)
      setStrategyData()
    } catch (e) {
      console.log(e)
      setTxLoading(false)
    }
  }

  const handleTokenChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setUseUsdc(event.target.checked)

    if (depositOption === 0) {
      resetDepositAmount()
    } else {
      resetWithdrawAmount()
    }
  }, [])

  const setDepositMax = () => {
    if (!useUsdc) setDepositAmount(toTokenAmount(balance ?? BIG_ZERO, 18).toString())
    else setDepositAmount(usdcBalance.toString())
  }

  const setWithdrawMax = () => {
    if (!useUsdc) setWithdrawAmount(currentEthValue.toString())
    else setWithdrawAmount(currentUsdcValue.toString())
  }

  const depositToken = useMemo(() => (useUsdc ? 'USDC' : 'ETH'), [useUsdc])

  // Update deposit step
  useEffect(() => {
    if (useUsdc) {
      if (usdcAllowance.lt(depositAmountBN)) {
        setDepositStep(DepositSteps.APPROVE)
      } else {
        setDepositStep(DepositSteps.DEPOSIT)
      }
    } else {
      setDepositStep(DepositSteps.DEPOSIT)
    }
  }, [useUsdc, usdcAllowance, depositAmountBN])

  // Update withdraw step
  useEffect(() => {
    if (useUsdc) {
      if (crabAllowance.lt(withdrawCrabAmount)) {
        setWithdrawStep(WithdrawSteps.APPROVE)
      } else {
        setWithdrawStep(WithdrawSteps.WITHDRAW)
      }
    } else {
      setWithdrawStep(WithdrawSteps.WITHDRAW)
    }
  }, [useUsdc, crabAllowance, withdrawCrabAmount])

  return (
    <>
      {confirmed ? (
        <>
          <Confirmed
            confirmationMessage={
              depositOption === 0
                ? `Deposited ${depositAmountBN.toFixed(4)} ${depositToken}`
                : `Withdrawn ${withdrawAmountBN.toFixed(4)} ${depositToken}`
            }
            txnHash={transactionData?.hash ?? ''}
            confirmType={ConfirmType.CRAB}
          />
          <PrimaryButtonNew
            fullWidth
            id="crab-close-btn"
            variant="contained"
            onClick={() => {
              resetTransactionData()
              setWithdrawAmount('0')
              setDepositAmount('0')
            }}
          >
            Close
          </PrimaryButtonNew>
        </>
      ) : (
        <>
          <SqueethTabsNew
            value={depositOption}
            onChange={(evt, val) => setDepositOption(val)}
            aria-label="simple tabs example"
            centered
            variant="fullWidth"
            className={classes.tabBackGround}
          >
            <SqueethTabNew id="crab-deposit-tab" label="Deposit" />
            <SqueethTabNew id="crab-withdraw-tab" label="Withdraw" />
          </SqueethTabsNew>

          <Box marginTop="32px" display="flex" justifyContent="space-between" alignItems="center" gridGap="12px">
            <Typography variant="h4" className={classes.subtitle}>
              Strategy {depositOption === 0 ? 'Deposit' : 'Withdraw'}
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

          <div className={classes.tradeContainer}>
            <div>
              {depositOption !== 0 && isClaimAndWithdraw && currentEthActualValue.gt(0) ? (
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
            {depositOption === 0 ? (
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
            ) : (
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
            )}
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
            {depositFundingWarning && depositOption === 0 ? (
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
            ) : null}
            {withdrawFundingWarning && depositOption !== 0 ? (
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
            {depositPriceImpactWarning && depositOption === 0 ? (
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
                  High price impact. Try smaller amount or contact us through{' '}
                  <LinkWrapper href="https://tiny.cc/opyndiscord">discord</LinkWrapper> about OTC
                </Typography>
              </div>
            ) : null}
            {withdrawPriceImpactWarning && depositOption !== 0 ? (
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
                  High price impact. Try smaller amount or contact us through{' '}
                  <LinkWrapper href="https://tiny.cc/opyndiscord">discord</LinkWrapper> about OTC
                </Typography>
              </div>
            ) : null}

            <Box display="flex" flexDirection="column" gridGap="12px" marginTop="24px">
              {useUsdc && depositOption !== 0 ? (
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
                  {depositOption === 0 ? (
                    <Metric
                      label="Price Impact"
                      value={formatNumber(Number(depositPriceImpact)) + '%'}
                      isSmall
                      flexDirection="row"
                      justifyContent="space-between"
                      gridGap="12px"
                    />
                  ) : (
                    <Metric
                      label="Price Impact"
                      value={formatNumber(Number(withdrawPriceImpact)) + '%'}
                      isSmall
                      flexDirection="row"
                      justifyContent="space-between"
                      gridGap="12px"
                    />
                  )}

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
              ) : depositOption === 0 ? (
                <PrimaryButtonNew
                  fullWidth
                  id="crab-deposit-btn"
                  variant={
                    Number(depositPriceImpact) > 3 || !!warning || depositFundingWarning || depositPriceImpactWarning
                      ? 'outlined'
                      : 'contained'
                  }
                  onClick={() => depositTX()}
                  disabled={txLoading || !!depositError}
                  style={
                    Number(depositPriceImpact) > 3 || !!warning
                      ? { color: '#f5475c', backgroundColor: 'transparent', borderColor: '#f5475c', marginTop: '8px' }
                      : depositFundingWarning || depositPriceImpactWarning
                      ? { color: '#F3FF6C', backgroundColor: 'transparent', borderColor: '#F3FF6C', marginTop: '8px' }
                      : { marginTop: '8px' }
                  }
                >
                  {!txLoading &&
                  (depositFundingWarning || depositPriceImpactWarning) &&
                  depositStep === DepositSteps.DEPOSIT ? (
                    'Deposit anyway'
                  ) : !txLoading ? (
                    depositStep
                  ) : (
                    <CircularProgress color="primary" size="1.5rem" />
                  )}
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
                  onClick={() => withdraw()}
                  disabled={txLoading || !!withdrawError}
                >
                  {!txLoading &&
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
        </>
      )}
    </>
  )
}

export default CrabTradeV2

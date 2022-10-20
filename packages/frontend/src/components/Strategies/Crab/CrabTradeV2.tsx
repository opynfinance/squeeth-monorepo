import { PrimaryButton } from '@components/Button'
import { PrimaryInput } from '@components/Input/PrimaryInput'
import { SecondaryTabs, SecondaryTab } from '@components/Tabs'
import Confirmed, { ConfirmType } from '@components/Trade/Confirmed'
import TradeInfoItem from '@components/Trade/TradeInfoItem'
import { TradeSettings } from '@components/TradeSettings'
import { useRestrictUser } from '@context/restrict-user'
import RestrictionInfo from '@components/RestrictionInfo'
import { CircularProgress, Tooltip, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { toTokenAmount } from '@utils/calculations'
import BigNumber from 'bignumber.js'
import React, { useEffect, useState } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { addressAtom, connectedWalletAtom } from 'src/state/wallet/atoms'
import { useTransactionStatus, useWalletBalance } from 'src/state/wallet/hooks'
import { BIG_ZERO, FUNDING_PERIOD, INDEX_SCALE, VOL_PERCENT_FIXED, VOL_PERCENT_SCALAR, YEAR } from '../../../constants'
import { readyAtom } from 'src/state/squeethPool/atoms'
import InfoIcon from '@material-ui/icons/Info'

import {
  crabStrategySlippageAtomV2,
  currentCrabPositionETHActualAtomV2,
  isPriceHedgeAvailableAtomV2,
  isTimeHedgeAvailableAtomV2,
} from 'src/state/crab/atoms'
import {
  useSetStrategyDataV2,
  useFlashDepositV2,
  useCalculateETHtoBorrowFromUniswapV2,
  useFlashWithdrawEthV2,
  useCalculateEthWillingToPayV2,
  useClaimAndWithdrawEthV2,
} from 'src/state/crab/hooks'
import { useUserCrabV2TxHistory } from '@hooks/useUserCrabV2TxHistory'
import { usePrevious } from 'react-use'
import {
  currentImpliedFundingAtom,
  dailyHistoricalFundingAtom,
  impliedVolAtom,
  indexAtom,
  normFactorAtom,
} from 'src/state/controller/atoms'
import CrabPositionV2 from './CrabPositionV2'
import { userMigratedSharesETHAtom } from 'src/state/crabMigration/atom'
import { useUpdateSharesData } from 'src/state/crabMigration/hooks'
import useAppMemo from '@hooks/useAppMemo'
import { LinkWrapper } from '@components/LinkWrapper'

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
      marginTop: theme.spacing(0.5),
      marginLeft: theme.spacing(37),
      justifyContent: 'right',
      alignSelf: 'center',
    },
    tradeContainer: {
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(1, 3),
      paddingBottom: theme.spacing(3),
    },
    tabBackGround: {
      position: 'sticky',
      top: '0',
      zIndex: 20,
      // background: '#2A2D2E',
    },
    notice: {
      marginTop: theme.spacing(1.5),
      marginBottom: theme.spacing(2),
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
      marginTop: theme.spacing(1.5),
      marginBottom: theme.spacing(2),
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
  }),
)

type CrabTradeV2Type = {
  maxCap: BigNumber
  depositedAmount: BigNumber
}

const CrabTradeV2: React.FC<CrabTradeV2Type> = ({ maxCap, depositedAmount }) => {
  const classes = useStyles()
  const [ethAmount, setEthAmount] = useState(new BigNumber(0))
  const [withdrawAmount, setWithdrawAmount] = useState(new BigNumber(0))
  const [depositOption, setDepositOption] = useState(0)
  const [txLoading, setTxLoading] = useState(false)
  const [depositPriceImpact, setDepositPriceImpact] = useState('0')
  const [withdrawPriceImpact, setWithdrawPriceImpact] = useState('0')
  const [borrowEth, setBorrowEth] = useState(new BigNumber(0))
  const [squeethAmountInFromDeposit, setSqueethAmountInFromDeposit] = useState(new BigNumber(0))
  const [ethAmountOutFromDeposit, setEthAmountOutFromDeposit] = useState(new BigNumber(0))
  const [ethAmountInFromWithdraw, setEthAmountInFromWithdraw] = useState(new BigNumber(0))
  const [squeethAmountOutFromWithdraw, setSqueethAmountOutFromWithdraw] = useState(new BigNumber(0))

  const connected = useAtomValue(connectedWalletAtom)
  const currentEthActualValue = useAtomValue(currentCrabPositionETHActualAtomV2)
  const migratedCurrentEthValue = useAtomValue(userMigratedSharesETHAtom)
  const [slippage, setSlippage] = useAtom(crabStrategySlippageAtomV2)

  const currentEthValue = migratedCurrentEthValue.gt(0) ? migratedCurrentEthValue : currentEthActualValue
  const isClaimAndWithdraw = migratedCurrentEthValue.gt(0)

  const { data: balance } = useWalletBalance()
  const setStrategyData = useSetStrategyDataV2()
  const flashWithdrawEth = useFlashWithdrawEthV2()
  const claimAndWithdrawEth = useClaimAndWithdrawEthV2()
  const calculateEthWillingToPay = useCalculateEthWillingToPayV2()
  const calculateETHtoBorrowFromUniswap = useCalculateETHtoBorrowFromUniswapV2()
  const updateSharesData = useUpdateSharesData()
  const flashDeposit = useFlashDepositV2(calculateETHtoBorrowFromUniswap)
  const index = useAtomValue(indexAtom)
  const ethIndexPrice = toTokenAmount(index, 18).sqrt()

  const { confirmed, resetTransactionData, transactionData } = useTransactionStatus()

  const ready = useAtomValue(readyAtom)
  const { isRestricted } = useRestrictUser()

  const dailyHistoricalFunding = useAtomValue(dailyHistoricalFundingAtom)
  const currentImpliedFunding = useAtomValue(currentImpliedFundingAtom)

  const address = useAtomValue(addressAtom)
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
      if (ethAmount.plus(depositedAmount).gte(maxCap)) {
        depositError = 'Amount greater than strategy cap'
      } else if (ethAmount.plus(depositedAmount).plus(borrowEth).gte(maxCap)) {
        depositError = `Amount greater than strategy cap since it flash borrows ${borrowEth.toFixed(
          2,
        )} ETH. Input a smaller amount`
      } else if (toTokenAmount(balance ?? BIG_ZERO, 18).lt(ethAmount)) {
        depositError = 'Insufficient ETH balance'
      }
      if (withdrawAmount.gt(currentEthValue)) {
        withdrawError = 'Withdraw amount greater than strategy balance'
      }
    }

    return { depositError, warning, withdrawError }
  }, [
    connected,
    ethAmount.toString(),
    depositedAmount.toString(),
    maxCap.toString(),
    borrowEth.toString(),
    balance?.toString(),
    withdrawAmount.toString(),
    currentEthValue.toString(),
    currentImpliedFunding.toString(),
    dailyHistoricalFunding.funding,
    dailyHistoricalFunding.period,
  ])

  useEffect(() => {
    if (!ready || depositOption !== 0) return

    calculateETHtoBorrowFromUniswap(ethAmount, slippage).then((q) => {
      setDepositPriceImpact(q.priceImpact)
      setBorrowEth(q.ethBorrow)
      setEthAmountOutFromDeposit(q.amountOut)
      setSqueethAmountInFromDeposit(q.initialWSqueethDebt)
    })
  }, [ready, ethAmount.toString(), slippage])

  useEffect(() => {
    if (!ready || depositOption === 0) return

    calculateEthWillingToPay(withdrawAmount, slippage).then((q) => {
      setWithdrawPriceImpact(q.priceImpact)
      setEthAmountInFromWithdraw(q.amountIn)
      setSqueethAmountOutFromWithdraw(q.squeethDebt)
    })
  }, [ready, withdrawAmount.toString(), slippage])

  const deposit = async () => {
    setTxLoading(true)
    try {
      await flashDeposit(ethAmount, slippage, () => {
        setTxLoading(false)
        setStrategyData()
      })
    } catch (e) {
      console.log(e)
      setTxLoading(false)
    }
  }

  const withdraw = async () => {
    setTxLoading(true)
    try {
      if (isClaimAndWithdraw) {
        await claimAndWithdrawEth(withdrawAmount, slippage)
      } else {
        await flashWithdrawEth(withdrawAmount, slippage)
      }
      updateSharesData()
      setTxLoading(false)
      setStrategyData()
    } catch (e) {
      console.log(e)
      setTxLoading(false)
    }
  }

  if (isRestricted) {
    return <RestrictionInfo />
  }

  return (
    <>
      {confirmed ? (
        <div className={classes.confirmedBox}>
          <Confirmed
            confirmationMessage={
              depositOption === 0
                ? `Deposited ${ethAmount.toFixed(4)} ETH`
                : `Withdrawn ${withdrawAmount.toFixed(4)} ETH`
            }
            txnHash={transactionData?.hash ?? ''}
            confirmType={ConfirmType.CRAB}
          />
          <PrimaryButton
            id="crab-close-btn"
            variant="contained"
            style={{ marginTop: '16px' }}
            onClick={() => {
              resetTransactionData()
              setWithdrawAmount(new BigNumber(0))
              setEthAmount(new BigNumber(0))
            }}
          >
            Close
          </PrimaryButton>
        </div>
      ) : (
        <>
          <SecondaryTabs
            value={depositOption}
            onChange={(evt, val) => setDepositOption(val)}
            aria-label="simple tabs example"
            centered
            variant="fullWidth"
            className={classes.tabBackGround}
          >
            <SecondaryTab id="crab-deposit-tab" label="Deposit" />
            <SecondaryTab id="crab-withdraw-tab" label="Withdraw" />
          </SecondaryTabs>
          <div className={classes.settingsButton}>
            <TradeSettings
              isCrab={true}
              setCrabSlippage={(s) => setSlippage(s.toNumber())}
              crabSlippage={new BigNumber(slippage)}
            />
          </div>
          <div className={classes.tradeContainer}>
            <div style={{ marginBottom: '8px' }}>
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
              <PrimaryInput
                id="crab-deposit-eth-input"
                value={ethAmount.toString()}
                onChange={(v) => setEthAmount(new BigNumber(v))}
                label="Amount"
                tooltip="ETH Amount to deposit"
                actionTxt="Max"
                unit="ETH"
                hint={
                  depositError
                    ? depositError
                    : warning
                    ? warning
                    : `Balance ${toTokenAmount(balance ?? BIG_ZERO, 18).toFixed(6)} ETH`
                }
                convertedValue={ethIndexPrice.times(ethAmount).toFixed(2)}
                onActionClicked={() => setEthAmount(toTokenAmount(balance ?? BIG_ZERO, 18))}
                error={!!depositError}
              />
            ) : (
              <PrimaryInput
                id="crab-withdraw-eth-input"
                value={withdrawAmount.toString()}
                onChange={(v) => setWithdrawAmount(new BigNumber(v))}
                label="Amount"
                tooltip="Amount of ETH to withdraw"
                actionTxt="Max"
                unit="ETH"
                convertedValue={ethIndexPrice.times(withdrawAmount).toFixed(2)}
                hint={
                  withdrawError ? (
                    withdrawError
                  ) : (
                    <span>
                      Position <span id="current-crab-eth-bal-input">{currentEthValue.toFixed(6)}</span> ETH
                    </span>
                  )
                }
                onActionClicked={() => setWithdrawAmount(currentEthValue)}
                error={!!withdrawError}
              />
            )}
            <div className={classes.noticeGray}>
              <div className={classes.infoIconGray}>
                <InfoIcon fontSize="medium" />
              </div>
              <Typography variant="caption" color="textSecondary">
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
                <Typography variant="caption">
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
                <Typography variant="caption">
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
                <Typography variant="caption">
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
                <Typography variant="caption">
                  High price impact. Try smaller amount or contact us through{' '}
                  <LinkWrapper href="https://tiny.cc/opyndiscord">discord</LinkWrapper> about OTC
                </Typography>
              </div>
            ) : null}
            <TradeInfoItem
              label="Slippage"
              value={slippage.toString()}
              tooltip="The strategy uses a uniswap flashswap to make a deposit. You can adjust slippage for this swap by clicking the gear icon"
              unit="%"
            />
            {depositOption === 0 ? (
              <TradeInfoItem
                label="Price Impact"
                value={depositPriceImpact}
                unit="%"
                color={Number(depositPriceImpact) > 3 ? 'red' : Number(depositPriceImpact) < 1 ? 'green' : undefined}
              />
            ) : (
              <TradeInfoItem
                label="Price Impact"
                value={withdrawPriceImpact}
                unit="%"
                color={Number(withdrawPriceImpact) > 3 ? 'red' : Number(depositPriceImpact) < 1 ? 'green' : undefined}
              />
            )}

            {depositOption === 0 ? (
              <PrimaryButton
                id="crab-deposit-btn"
                variant={
                  Number(depositPriceImpact) > 3 || !!warning || depositFundingWarning || depositPriceImpactWarning
                    ? 'outlined'
                    : 'contained'
                }
                onClick={() => deposit()}
                disabled={txLoading || !!depositError}
                style={
                  Number(depositPriceImpact) > 3 || !!warning
                    ? { color: '#f5475c', backgroundColor: 'transparent', borderColor: '#f5475c', marginTop: '8px' }
                    : depositFundingWarning || depositPriceImpactWarning
                    ? { color: '#F3FF6C', backgroundColor: 'transparent', borderColor: '#F3FF6C', marginTop: '8px' }
                    : { marginTop: '8px' }
                }
              >
                {!txLoading && (depositFundingWarning || depositPriceImpactWarning) ? (
                  'Deposit anyway'
                ) : !txLoading ? (
                  'Deposit'
                ) : (
                  <CircularProgress color="primary" size="1.5rem" />
                )}
              </PrimaryButton>
            ) : (
              <PrimaryButton
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
                {!txLoading && (withdrawFundingWarning || withdrawPriceImpactWarning) ? (
                  'Withdraw anyway'
                ) : !txLoading ? (
                  'Withdraw'
                ) : (
                  <CircularProgress color="primary" size="1.5rem" />
                )}
              </PrimaryButton>
            )}
            <CrabPositionV2 />
          </div>
        </>
      )}
    </>
  )
}

export default CrabTradeV2

import { PrimaryButton } from '@components/Button'
import { PrimaryInput } from '@components/Input/PrimaryInput'
import { SecondaryTabs, SecondaryTab } from '@components/Tabs'
import Confirmed, { ConfirmType } from '@components/Trade/Confirmed'
import TradeInfoItem from '@components/Trade/TradeInfoItem'
import { TradeSettings } from '@components/TradeSettings'
import { useRestrictUser } from '@context/restrict-user'
import RestrictionInfo from '@components/RestrictionInfo'
import { CircularProgress, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { toTokenAmount } from '@utils/calculations'
import BigNumber from 'bignumber.js'
import React, { useEffect, useMemo, useState } from 'react'
import CrabPosition from './CrabPosition'
import { useAtom, useAtomValue } from 'jotai'
import { addressAtom, connectedWalletAtom } from 'src/state/wallet/atoms'
import { useTransactionStatus, useWalletBalance } from 'src/state/wallet/hooks'
import { BIG_ZERO } from '../../../constants'
import { readyAtom } from 'src/state/squeethPool/atoms'
import {
  crabStrategySlippageAtom,
  currentCrabPositionValueInETHAtom,
  isPriceHedgeAvailableAtom,
  isTimeHedgeAvailableAtom,
} from 'src/state/crab/atoms'
import {
  useFlashDeposit,
  useCalculateETHtoBorrowFromUniswap,
  useCalculateEthWillingToPay,
  useFlashWithdrawEth,
  useSetStrategyData,
} from 'src/state/crab/hooks'
import { useUserCrabTxHistory } from '@hooks/useUserCrabTxHistory'
import { usePrevious } from 'react-use'
import { currentImpliedFundingAtom, dailyHistoricalFundingAtom, indexAtom } from 'src/state/controller/atoms'
import CrabMigration from './CrabMigrate'
import { isQueuedAtom } from 'src/state/crabMigration/atom'

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
  }),
)

type CrabTradeType = {
  maxCap: BigNumber
  depositedAmount: BigNumber
}

const CrabTrade: React.FC<CrabTradeType> = ({ maxCap, depositedAmount }) => {
  const classes = useStyles()
  const [ethAmount, setEthAmount] = useState(new BigNumber(0))
  const [withdrawAmount, setWithdrawAmount] = useState(new BigNumber(0))
  const [depositOption, setDepositOption] = useState(0)
  const [txLoading, setTxLoading] = useState(false)
  const [depositPriceImpact, setDepositPriceImpact] = useState('0')
  const [withdrawPriceImpact, setWithdrawPriceImpact] = useState('0')
  const [borrowEth, setBorrowEth] = useState(new BigNumber(0))

  const connected = useAtomValue(connectedWalletAtom)
  const currentEthValue = useAtomValue(currentCrabPositionValueInETHAtom)
  const isTimeHedgeAvailable = useAtomValue(isTimeHedgeAvailableAtom)
  const isPriceHedgeAvailable = useAtomValue(isPriceHedgeAvailableAtom)
  const [slippage, setSlippage] = useAtom(crabStrategySlippageAtom)
  const isQueued = useAtomValue(isQueuedAtom)
  const { data: balance } = useWalletBalance()
  const setStrategyData = useSetStrategyData()
  const flashWithdrawEth = useFlashWithdrawEth()
  const calculateEthWillingToPay = useCalculateEthWillingToPay()
  const calculateETHtoBorrowFromUniswap = useCalculateETHtoBorrowFromUniswap()
  const flashDeposit = useFlashDeposit(calculateETHtoBorrowFromUniswap)
  const index = useAtomValue(indexAtom)
  const ethIndexPrice = toTokenAmount(index, 18).sqrt()

  const { confirmed, resetTransactionData, transactionData } = useTransactionStatus()

  const ready = useAtomValue(readyAtom)
  const { isRestricted } = useRestrictUser()

  const dailyHistoricalFunding = useAtomValue(dailyHistoricalFundingAtom)
  const currentImpliedFunding = useAtomValue(currentImpliedFundingAtom)

  const address = useAtomValue(addressAtom)
  const { data, startPolling, stopPolling } = useUserCrabTxHistory(address ?? '')

  const prevCrabTxData = usePrevious(data)

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

  const { depositError, warning, withdrawError } = useMemo(() => {
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
      if (isTimeHedgeAvailable || isPriceHedgeAvailable) {
        depositError = 'Deposits and withdraws available after the hedge auction'
        withdrawError = 'Deposits and withdraws available after the hedge auction'
      }
      if (currentImpliedFunding <= 0.75 * dailyHistoricalFunding.funding) {
        warning = `Current implied premiums is 75% lower than the last ${dailyHistoricalFunding.period} hours. Consider if you want to deposit now or later`
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
    isTimeHedgeAvailable,
    isPriceHedgeAvailable,
  ])

  useEffect(() => {
    if (!ready || depositOption !== 0) return

    calculateETHtoBorrowFromUniswap(ethAmount, slippage).then((q) => {
      setDepositPriceImpact(q.priceImpact)
      setBorrowEth(q.ethBorrow)
    })
  }, [ready, ethAmount.toString(), slippage])

  useEffect(() => {
    if (!ready || depositOption === 0) return

    calculateEthWillingToPay(withdrawAmount, slippage).then((q) => setWithdrawPriceImpact(q.priceImpact))
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
      await flashWithdrawEth(withdrawAmount, slippage, () => {
        setTxLoading(false)
        setStrategyData()
      })
    } catch (e) {
      console.log(e)
      setTxLoading(false)
    }
  }

  if (isRestricted) {
    return <RestrictionInfo />
  }

  const isApprovalCall = useMemo(() => {
    return transactionData?.contractCall?.methodName === 'approve'
  }, [transactionData])

  if (currentEthValue.isZero()) {
    return null
  }

  return (
    <>
      {confirmed && !isApprovalCall ? (
        <div className={classes.confirmedBox}>
          <Confirmed
            confirmationMessage={
              depositOption === 0
                ? `Woohoo! You're guaranteed a spot in crab v2 `
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
          {!isQueued ? (
            <SecondaryTabs
              value={depositOption}
              onChange={(evt, val) => setDepositOption(val)}
              aria-label="simple tabs example"
              centered
              variant="fullWidth"
              className={classes.tabBackGround}
            >
              <SecondaryTab id="crab-deposit-tab" label="Migrate to v2" />
              <SecondaryTab id="crab-withdraw-tab" label="Withdraw" />
            </SecondaryTabs>
          ) : null}
          {depositOption === 0 ? null : (
            <div className={classes.settingsButton}>
              <TradeSettings
                isCrab={true}
                setCrabSlippage={(s) => setSlippage(s.toNumber())}
                crabSlippage={new BigNumber(slippage)}
              />
            </div>
          )}
          <div className={classes.tradeContainer}>
            {depositOption === 0 ? (
              !currentEthValue.isZero() ? (
                <Typography variant="body2" color="textSecondary" style={{ marginTop: '20px' }}>
                  Didn't migrate from Crab V1 during early access? Migration to V2 coming soon.
                </Typography>
              ) : (
                <>
                  <Typography variant="body2" color="textSecondary" style={{ marginTop: '8px' }}>
                    You don't have a Crab v1 position to migrate
                  </Typography>
                </>
              )
            ) : (
              <>
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
                          Position{' '}
                          <span id="current-crab-eth-bal-input">
                            {(isQueued ? BIG_ZERO : currentEthValue).toFixed(6)}
                          </span>{' '}
                          ETH
                        </span>
                      )
                    }
                    onActionClicked={() => setWithdrawAmount(currentEthValue)}
                    error={!!withdrawError}
                  />
                )}
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
                    color={
                      Number(depositPriceImpact) > 3 ? 'red' : Number(depositPriceImpact) < 1 ? 'green' : undefined
                    }
                  />
                ) : (
                  <TradeInfoItem
                    label="Price Impact"
                    value={withdrawPriceImpact}
                    unit="%"
                    color={
                      Number(withdrawPriceImpact) > 3 ? 'red' : Number(depositPriceImpact) < 1 ? 'green' : undefined
                    }
                  />
                )}

                {depositOption === 0 ? (
                  <PrimaryButton
                    id="crab-deposit-btn"
                    variant={Number(depositPriceImpact) > 3 || !!warning ? 'outlined' : 'contained'}
                    onClick={() => deposit()}
                    disabled={txLoading || !!depositError}
                    style={
                      Number(depositPriceImpact) > 3 || !!warning
                        ? { color: '#f5475c', backgroundColor: 'transparent', borderColor: '#f5475c', marginTop: '8px' }
                        : { marginTop: '8px' }
                    }
                  >
                    {!txLoading ? 'Deposit' : <CircularProgress color="primary" size="1.5rem" />}
                  </PrimaryButton>
                ) : (
                  <PrimaryButton
                    id="crab-withdraw-btn"
                    variant={Number(withdrawPriceImpact) > 3 ? 'outlined' : 'contained'}
                    style={
                      Number(withdrawPriceImpact) > 3
                        ? { color: '#f5475c', backgroundColor: 'transparent', borderColor: '#f5475c', marginTop: '8px' }
                        : { marginTop: '8px' }
                    }
                    onClick={() => withdraw()}
                    disabled={txLoading || !!withdrawError || isQueued}
                  >
                    {!txLoading ? 'Withdraw' : <CircularProgress color="primary" size="1.5rem" />}
                  </PrimaryButton>
                )}
              </>
            )}
            <CrabPosition />
          </div>
        </>
      )}
    </>
  )
}

export default CrabTrade

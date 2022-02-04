import { PrimaryButton } from '@components/Button'
import { PrimaryInput } from '@components/Input/PrimaryInput'
import { SecondaryTabs, SecondaryTab } from '@components/Tabs'
import Confirmed, { ConfirmType } from '@components/Trade/Confirmed'
import TradeInfoItem from '@components/Trade/TradeInfoItem'
import { TradeSettings } from '@components/TradeSettings'
import { useCrab } from '@context/crabStrategy'
import { useRestrictUser } from '@context/restrict-user'
import { useWallet } from '@context/wallet'
import RestrictionInfo from '@components/RestrictionInfo'
import { useCrabPosition } from '@hooks/useCrabPosition'
import { CircularProgress } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { toTokenAmount } from '@utils/calculations'
import BigNumber from 'bignumber.js'
import React, { useEffect, useMemo, useState } from 'react'
import CrabPosition from './CrabPosition'
import { readyAtom } from '@hooks/contracts/useSqueethPool'
import { currentImpliedFundingAtom, dailyHistoricalFundingAtom } from '@hooks/contracts/useController'
import { useGetAtom } from 'particule'

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
  const [txLoaded, setTxLoaded] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [depositPriceImpact, setDepositPriceImpact] = useState('0')
  const [withdrawPriceImpact, setWithdrawPriceImpact] = useState('0')
  const [borrowEth, setBorrowEth] = useState(new BigNumber(0))
  const { balance, address, connected } = useWallet()

  const {
    flashDeposit,
    flashWithdrawEth,
    currentEthValue,
    slippage,
    setSlippage,
    ethIndexPrice,
    calculateEthWillingToPay,
    calculateETHtoBorrowFromUniswap,
    isTimeHedgeAvailable,
    isPriceHedgeAvailable,
  } = useCrab()
  const { minCurrentUsd, minPnL, loading } = useCrabPosition(address || '')
  const { isRestricted } = useRestrictUser()
  const ready = useGetAtom(readyAtom)
  const dailyHistoricalFunding = useGetAtom(dailyHistoricalFundingAtom)
  const currentImpliedFunding = useGetAtom(currentImpliedFundingAtom)

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
      } else if (toTokenAmount(balance, 18).lt(ethAmount)) {
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
        warning = `Current implied funding is 75% lower than the last ${dailyHistoricalFunding.period} hours. Consider if you want to deposit now or later`
      }
    }

    return { depositError, warning, withdrawError }
  }, [
    connected,
    ethAmount.toString(),
    depositedAmount.toString(),
    maxCap.toString(),
    borrowEth.toString(),
    balance.toString(),
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
      const tx = await flashDeposit(ethAmount, slippage)
      setTxHash(tx.transactionHash)
      setTxLoaded(true)
    } catch (e) {
      console.log(e)
    }
    setTxLoading(false)
  }

  const withdraw = async () => {
    setTxLoading(true)
    try {
      const tx = await flashWithdrawEth(withdrawAmount, slippage)
      setTxHash(tx.transactionHash)
      setTxLoaded(true)
    } catch (e) {
      console.log(e)
    }
    setTxLoading(false)
  }

  if (isRestricted) {
    return <RestrictionInfo />
  }

  return (
    <>
      {txLoaded ? (
        <div className={classes.confirmedBox}>
          <Confirmed
            confirmationMessage={
              depositOption === 0
                ? `Deposited ${ethAmount.toFixed(4)} ETH`
                : `Withdrawn ${withdrawAmount.toFixed(4)} ETH`
            }
            txnHash={txHash}
            confirmType={ConfirmType.CRAB}
          />
          <PrimaryButton variant="contained" style={{ marginTop: '16px' }} onClick={() => setTxLoaded(false)}>
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
            <SecondaryTab label="Deposit" />
            <SecondaryTab label="Withdraw" />
          </SecondaryTabs>
          <div className={classes.settingsButton}>
            <TradeSettings
              isCrab={true}
              setCrabSlippage={(s) => setSlippage(s.toNumber())}
              crabSlippage={new BigNumber(slippage)}
            />
          </div>
          <div className={classes.tradeContainer}>
            {depositOption === 0 ? (
              <PrimaryInput
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
                    : `Balance ${toTokenAmount(balance, 18).toFixed(6)} ETH`
                }
                convertedValue={ethIndexPrice.times(ethAmount).toFixed(2)}
                onActionClicked={() => setEthAmount(toTokenAmount(balance, 18))}
                error={!!depositError}
              />
            ) : (
              <PrimaryInput
                value={withdrawAmount.toString()}
                onChange={(v) => setWithdrawAmount(new BigNumber(v))}
                label="Amount"
                tooltip="Amount of ETH to withdraw"
                actionTxt="Max"
                unit="ETH"
                convertedValue={ethIndexPrice.times(withdrawAmount).toFixed(2)}
                hint={withdrawError ? withdrawError : `Position ${currentEthValue.toFixed(6)} ETH`}
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
                variant={Number(withdrawPriceImpact) > 3 ? 'outlined' : 'contained'}
                style={
                  Number(withdrawPriceImpact) > 3
                    ? { color: '#f5475c', backgroundColor: 'transparent', borderColor: '#f5475c', marginTop: '8px' }
                    : { marginTop: '8px' }
                }
                onClick={() => withdraw()}
                disabled={txLoading || !!withdrawError}
              >
                {!txLoading ? 'Withdraw' : <CircularProgress color="primary" size="1.5rem" />}
              </PrimaryButton>
            )}
            <div style={{ marginTop: '16px' }}>
              <CrabPosition value={minCurrentUsd} pnl={minPnL} loading={loading} />
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default CrabTrade

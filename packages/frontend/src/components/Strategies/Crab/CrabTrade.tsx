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
import React, { useState } from 'react'
import CrabPosition from './CrabPosition'

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
      marginTop: theme.spacing(2),
      marginLeft: theme.spacing(37),
      justifyContent: 'right',
      alignSelf: 'center',
    },
    tradeContainer: {
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(2, 3),
    },
    tabBackGround: {
      position: 'sticky',
      top: '0',
      zIndex: 20,
      // background: '#2A2D2E',
    },
  }),
)

const CrabTrade: React.FC = () => {
  const classes = useStyles()
  const [ethAmount, setEthAmount] = useState(new BigNumber(0))
  const [withdrawAmount, setWithdrawAmount] = useState(new BigNumber(0))
  const [depositOption, setDepositOption] = useState(0)
  const [txLoading, setTxLoading] = useState(false)
  const [txLoaded, setTxLoaded] = useState(false)
  const [txHash, setTxHash] = useState('')
  const { balance, address } = useWallet()

  const { flashDeposit, flashWithdrawEth, currentEthValue, slippage, setSlippage, ethIndexPrice } = useCrab()
  const { minCurrentUsd, minPnL, loading } = useCrabPosition(address || '')
  const { isRestricted } = useRestrictUser()

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
                hint={`Balance ${toTokenAmount(balance, 18).toFixed(6)} ETH`}
                convertedValue={ethIndexPrice.times(ethAmount).toFixed(2)}
                onActionClicked={() => setEthAmount(toTokenAmount(balance, 18))}
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
                hint={`Position ${currentEthValue.toFixed(6)} ETH`}
                onActionClicked={() => setWithdrawAmount(currentEthValue)}
              />
            )}
            <TradeInfoItem
              label="Slippage"
              value={slippage.toString()}
              tooltip="The strategy uses a uniswap flashswap to make a deposit. You can adjust slippage for this swap by clicking the gear icon"
              unit="%"
            />
            {depositOption === 0 ? (
              <PrimaryButton
                variant="contained"
                style={{ marginTop: '8px' }}
                onClick={() => deposit()}
                disabled={txLoading}
              >
                {!txLoading ? 'Deposit' : <CircularProgress color="primary" size="1.5rem" />}
              </PrimaryButton>
            ) : (
              <PrimaryButton
                variant="contained"
                style={{ marginTop: '8px' }}
                onClick={() => withdraw()}
                disabled={txLoading}
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

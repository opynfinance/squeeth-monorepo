import { PrimaryButton } from '@components/Button'
import { PrimaryInput } from '@components/Input/PrimaryInput'
import Nav from '@components/Nav'
import CapDetails from '@components/Strategies/Crab/CapDetails'
import CrabStrategyHistory from '@components/Strategies/Crab/StrategyHistory'
import StrategyInfo from '@components/Strategies/Crab/StrategyInfo'
import CrabPosition from '@components/Strategies/Crab/CrabPosition'
import StrategyInfoItem from '@components/Strategies/StrategyInfoItem'
import { SecondaryTab, SecondaryTabs } from '@components/Tabs'
import Confirmed, { ConfirmType } from '@components/Trade/Confirmed'
import { useWallet } from '@context/wallet'
import { CrabProvider, useCrab } from '@context/crabStrategy'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import { useAddresses } from '@hooks/useAddress'
import { CircularProgress, InputAdornment, TextField, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { useController } from '@hooks/contracts/useController'
import { toTokenAmount } from '@utils/calculations'
import { useWorldContext } from '@context/world'
import BigNumber from 'bignumber.js'
import React, { useState } from 'react'
import { Tooltips } from '@constants/index'
import TradeInfoItem from '@components/Trade/TradeInfoItem'
import { TradeSettings } from '@components/TradeSettings'
import { Links, Vaults } from '@constants/enums'
import { CrabStrategyChart } from '@components/Charts/CrabStrategyChart'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(4, 20),
      marginLeft: 'auto',
      marginRight: 'auto',
      maxWidth: '1500px',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
    },
    body: {
      display: 'flex',
      marginTop: theme.spacing(3),
    },
    tradeContainer: {
      display: 'flex',
      flexDirection: 'column',
      padding: theme.spacing(2, 3),
    },
    confirmedBox: {
      display: 'flex',
      justifyContent: 'center',
      textAlign: 'center',
      flexDirection: 'column',
      padding: theme.spacing(2, 3),
    },
    tradeForm: {
      background: theme.palette.background.stone,
      borderRadius: theme.spacing(2),
      margin: theme.spacing(0, 'auto'),
      width: '350px',
      position: 'sticky',
      height: '420px',
      top: '100px',
    },
    overview: {
      display: 'flex',
      columnGap: '20px',
      marginTop: theme.spacing(3),
    },
    details: {
      display: 'flex',
      flexDirection: 'column',
      paddingRight: theme.spacing(5),
    },
    tabBackGround: {
      position: 'sticky',
      top: '0',
      zIndex: 20,
      // background: '#2A2D2E',
    },
    settingsButton: {
      marginTop: theme.spacing(2),
      marginLeft: theme.spacing(37),
      justifyContent: 'right',
      alignSelf: 'center',
    },
    chartContainer: {
      padding: theme.spacing(0),
      marginTop: theme.spacing(4),
      maxWidth: '640px',
    },
    link: {
      color: theme.palette.primary.main,
    },
  }),
)

const Strategies: React.FC = () => {
  const [ethAmount, setEthAmount] = useState(new BigNumber(0))
  const [withdrawAmount, setWithdrawAmount] = useState(new BigNumber(0))
  const [depositOption, setDepositOption] = useState(0)
  const [slippage, setSlippage] = useState(new BigNumber(0.5))
  const [txLoading, setTxLoading] = useState(false)
  const [txLoaded, setTxLoaded] = useState(false)
  const [txHash, setTxHash] = useState('')

  const classes = useStyles()
  const { balance, address } = useWallet()
  const {
    maxCap,
    vault,
    flashDeposit,
    collatRatio,
    flashWithdrawEth,
    timeAtLastHedge,
    liquidationPrice,
    userCrabBalance,
    currentEthValue,
    flashWithdraw,
    profitableMovePercent,
  } = useCrab()
  const { crabStrategy } = useAddresses()
  const crabBalance = useTokenBalance(crabStrategy, 10, 18)
  const { index, currentImpliedFunding, fundingPerHalfHour } = useController()
  const { ethPrice } = useWorldContext()

  const deposit = async () => {
    setTxLoading(true)
    try {
      const tx = await flashDeposit(ethAmount, slippage.toNumber())
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
      const tx = await flashWithdrawEth(withdrawAmount, slippage.toNumber())
      setTxHash(tx.transactionHash)
      setTxLoaded(true)
    } catch (e) {
      console.log(e)
    }
    setTxLoading(false)
  }

  return (
    <div>
      <Nav />
      <div className={classes.container}>
        <div className={classes.header}>
          <Typography variant="h6">🦀</Typography>
          <Typography variant="h6" style={{ marginLeft: '8px' }} color="primary">
            Crab Strategy
          </Typography>
        </div>
        <Typography variant="subtitle1" color="textSecondary" style={{ width: '60%', marginTop: '8px' }}>
          Crab strategy automates making money in a sideways market. Based on current funding, crab strategy would be
          profitable if ETH moves less than approximately {(profitableMovePercent * 100).toFixed(2)}% in either
          direction each day. The strategy rebalances daily, reducing risk of liquidations. You earn squeeth without
          being exposed to ETH price movements.
          <a className={classes.link} href={Links.CrabFAQ} target="_blank" rel="noreferrer">
            {' '}
            Learn more.{' '}
          </a>
        </Typography>
        <div className={classes.body}>
          <div className={classes.details}>
            <CapDetails maxCap={maxCap} depositedAmount={vault?.collateralAmount || new BigNumber(0)} />
            <div className={classes.overview}>
              <StrategyInfoItem
                value={Number(toTokenAmount(index, 18).sqrt()).toFixed(2).toLocaleString()}
                label="ETH Price ($)"
                tooltip={Tooltips.SpotPrice}
                priceType="spot"
              />
              <StrategyInfoItem
                value={(currentImpliedFunding * 100).toFixed(2)}
                label="Current Implied Funding (%)"
                tooltip={`${Tooltips.StrategyEarnFunding}. ${Tooltips.CurrentImplFunding}`}
              />
              <StrategyInfoItem
                value={(fundingPerHalfHour * 100).toFixed(2)}
                label="Historical Daily Funding (%)"
                tooltip={`${Tooltips.StrategyEarnFunding}. ${Tooltips.Last30MinAvgFunding}`}
              />
              {/* <StrategyInfoItem
                value={crabBalance.toFixed(4)}
                label="Position (CRAB)"
                tooltip={Tooltips.StrategyCollRatio}
              /> */}
            </div>
            <div className={classes.overview}>
              <StrategyInfoItem
                value={new Date(timeAtLastHedge * 1000).toLocaleString(undefined, {
                  day: 'numeric',
                  month: 'numeric',
                  hour: 'numeric',
                  minute: 'numeric',
                })}
                label="Last rebalanced at"
                tooltip={
                  'Last rebalanced at ' +
                  new Date(timeAtLastHedge * 1000).toLocaleString(undefined, {
                    day: 'numeric',
                    month: 'long',
                    hour: 'numeric',
                    minute: 'numeric',
                    timeZoneName: 'long',
                  }) +
                  '. Rebalances every 24hrs or every 1% ETH price move'
                }
              />
              <StrategyInfoItem
                value={vault?.shortAmount.toFixed(4)}
                label="Short oSQTH"
                tooltip={Tooltips.StrategyShort}
              />
              <StrategyInfoItem
                value={collatRatio.toString()}
                label="Collat Ratio (%)"
                tooltip={Tooltips.StrategyCollRatio}
              />
              {/* <StrategyInfoItem
                value={liquidationPrice.toFixed(2)}
                label="Liq Price ($)"
                tooltip={`${Tooltips.LiquidationPrice} ${Tooltips.StrategyLiquidations}`}
              /> */}
            </div>
            <div className={classes.chartContainer}>
              <CrabStrategyChart vault={Vaults.Short} longAmount={0} showPercentage={true} setCustomLong={() => null} />
            </div>
            <StrategyInfo />
            <CrabStrategyHistory />
          </div>
          <div className={classes.tradeForm}>
            {txLoaded ? (
              <div className={classes.confirmedBox}>
                <Confirmed
                  confirmationMessage={
                    depositOption === 0
                      ? `Deposited ${ethAmount.toFixed(4)} ETH`
                      : `Closed ${withdrawAmount.toFixed(4)} CRAB`
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
                  <TradeSettings isCrab={true} setCrabSlippage={setSlippage} crabSlippage={slippage} />
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
                      convertedValue={ethPrice.times(ethAmount).toFixed(2)}
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
                      convertedValue="0"
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
                    <CrabPosition user={address} />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const Page: React.FC = () => (
  <CrabProvider>
    <Strategies />
  </CrabProvider>
)

export default Page

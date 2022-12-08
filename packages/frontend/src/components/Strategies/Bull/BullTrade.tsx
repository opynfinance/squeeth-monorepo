import { Box, Tooltip, Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import BigNumber from 'bignumber.js'
import React, { useState } from 'react'
import { useAtomValue } from 'jotai'
import InfoIcon from '@material-ui/icons/Info'

import { PrimaryButtonNew } from '@components/Button'
import { SqueethTabsNew, SqueethTabNew } from '@components/Tabs'
import Confirmed, { ConfirmType } from '@components/Trade/Confirmed'
import { TradeSettings } from '@components/TradeSettings'
import RestrictionInfo from '@components/RestrictionInfo'
import { InputToken } from '@components/InputNew'
import { LinkWrapper } from '@components/LinkWrapper'
import Metric from '@components/Metric'
import { useSelectWallet } from '@state/wallet/hooks'
import { indexAtom } from '@state/controller/atoms'
import { BIG_ZERO } from '@constants/index'
import { toTokenAmount } from '@utils/calculations'
import { formatNumber } from '@utils/formatter'
import ethLogo from 'public/images/eth-logo.svg'
import { useBullFlashDeposit, useGetFlashBulldepositParams } from '@state/bull/hooks'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(2),
    },
    tradeContainer: {
      display: 'flex',
      flexDirection: 'column',
    },
    tabBackGround: {
      position: 'sticky',
      top: '0',
      zIndex: 20,
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
    subtitle: {
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    infoText: {
      fontWeight: 500,
      fontSize: '13px',
    },
    slippageContainer: {
      [theme.breakpoints.down('xs')]: {
        flexWrap: 'wrap',
      },
    },
  }),
)

type BullTrade = {
  maxCap: BigNumber
  depositedAmount: BigNumber
}

enum BullTradeType {
  Deposit = 'Deposit',
  Withdraw = 'Withdraw',
}

const BullTrade: React.FC<BullTrade> = ({ maxCap, depositedAmount }) => {
  const [tradeType, setTradeType] = useState(BullTradeType.Deposit)
  const [depositAmount, setDepositAmount] = useState('0')
  const [withdrawAmount, setWithdrawAmount] = useState('0')
  const [slippage, setSlippage] = useState(0.25)
  const isDeposit = tradeType === BullTradeType.Deposit
  const isWithdraw = tradeType === BullTradeType.Withdraw
  const tabValue = tradeType === BullTradeType.Deposit ? 0 : 1
  const [quoteLoading, setQuoteLoading] = useState(false)

  const negativeReturnsError = false
  const withdrawExpensive = false
  const highDepositWarning = false
  const highWithdrawWarning = false
  const isRestricted = false
  const connected = true
  const supportedNetwork = true

  const selectWallet = useSelectWallet()

  const index = useAtomValue(indexAtom)
  const ethIndexPrice = toTokenAmount(index, 18).sqrt()
  const classes = useStyles()
  const confirmed = false

  const [quote, setQuote] = useState({
    ethToCrab: BIG_ZERO,
    minEthFromSqth: BIG_ZERO,
    minEthFromUsdc: BIG_ZERO,
    wPowerPerpPoolFee: 0,
    usdcPoolFee: 0,
  })

  const getFlashBullDepositParams = useGetFlashBulldepositParams()
  const bullFlashDeposit = useBullFlashDeposit()

  const onInputChange = async (ethToDeposit: string) => {
    setQuoteLoading(true)
    setDepositAmount(ethToDeposit)
    const _quote = await getFlashBullDepositParams(new BigNumber(ethToDeposit))
    setQuote(_quote)
    setQuoteLoading(false)
  }

  const onDepositClick = async () => {
    const tx = bullFlashDeposit(
      quote.ethToCrab,
      quote.minEthFromSqth,
      quote.minEthFromUsdc,
      quote.wPowerPerpPoolFee,
      quote.usdcPoolFee,
      new BigNumber(depositAmount),
    )
  }

  return (
    <>
      {confirmed ? (
        <>
          <Confirmed confirmationMessage={`Confirmation Message`} txnHash={''} confirmType={ConfirmType.BULL} />
          <PrimaryButtonNew fullWidth id="bull-close-btn" variant="contained">
            Close
          </PrimaryButtonNew>
        </>
      ) : (
        <>
          <SqueethTabsNew
            value={tabValue}
            onChange={(_, val) => setTradeType(val === 0 ? BullTradeType.Deposit : BullTradeType.Withdraw)}
            aria-label="bull trade tabs"
            centered
            variant="fullWidth"
            className={classes.tabBackGround}
          >
            <SqueethTabNew id="bull-deposit-tab" label="Deposit" />
            <SqueethTabNew id="bull-withdraw-tab" label="Withdraw" />
          </SqueethTabsNew>

          <Box marginTop="32px" display="flex" justifyContent="space-between" alignItems="center" gridGap="12px">
            <Typography variant="h4" className={classes.subtitle}>
              Strategy {tradeType}
            </Typography>
          </Box>

          <div className={classes.tradeContainer}>
            {isDeposit && (
              <InputToken
                id="bull-deposit-eth-input"
                value={depositAmount}
                onInputChange={onInputChange}
                balance={toTokenAmount(0 ?? BIG_ZERO, 18)}
                logo={ethLogo}
                symbol={'ETH'}
                usdPrice={ethIndexPrice}
                error={false}
                helperText={``}
                balanceLabel="Balance"
                isLoading={quoteLoading}
                loadingMessage="Fetching best price"
              />
            )}
            {isWithdraw && (
              <InputToken
                id="bull-withdraw-eth-input"
                value={withdrawAmount}
                onInputChange={(v) => {
                  setWithdrawAmount(v)
                }}
                balance={new BigNumber(500)}
                logo={ethLogo}
                symbol={'ETH'}
                usdPrice={ethIndexPrice}
                error={false}
                helperText={``}
                balanceLabel="Balance"
              />
            )}

            {negativeReturnsError && isDeposit ? (
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
            {withdrawExpensive && isWithdraw ? (
              <div className={classes.notice}>
                <div className={classes.infoIcon}>
                  <Tooltip title={'expensive withdraw warning'}>
                    <InfoIcon fontSize="medium" />
                  </Tooltip>
                </div>
                <Typography variant="caption" className={classes.infoText}>
                  expensive withdraw warning
                </Typography>
              </div>
            ) : null}
            {highDepositWarning && isDeposit ? (
              <div className={classes.notice}>
                <div className={classes.infoIcon}>
                  <Tooltip title={'Too high deposit warning'}>
                    <InfoIcon fontSize="medium" />
                  </Tooltip>
                </div>
                <Typography variant="caption" className={classes.infoText}>
                  Too high deposit warning
                  <LinkWrapper href="https://tiny.cc/opyndiscord">discord</LinkWrapper> about OTC
                </Typography>
              </div>
            ) : null}
            {highWithdrawWarning && isWithdraw ? (
              <div className={classes.notice}>
                <div className={classes.infoIcon}>
                  <Tooltip title={'Too high withdraw warning'}>
                    <InfoIcon fontSize="medium" />
                  </Tooltip>
                </div>
                <Typography variant="caption" className={classes.infoText}>
                  Too high withdraw warning <LinkWrapper href="https://tiny.cc/opyndiscord">discord</LinkWrapper> about
                  OTC
                </Typography>
              </div>
            ) : null}

            <Box display="flex" flexDirection="column" gridGap="12px" marginTop="24px">
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                gridGap="12px"
                className={classes.slippageContainer}
              >
                <Metric
                  label="Slippage"
                  value={formatNumber(slippage) + '%'}
                  isSmall
                  flexDirection="row"
                  justifyContent="space-between"
                  gridGap="12px"
                />

                <Box display="flex" alignItems="center" gridGap="12px" flex="1">
                  {isDeposit ? (
                    <Metric
                      label="Price Impact"
                      value={formatNumber(Number(1)) + '%'}
                      isSmall
                      flexDirection="row"
                      justifyContent="space-between"
                      gridGap="12px"
                    />
                  ) : (
                    <Metric
                      label="Price Impact"
                      value={formatNumber(Number(2)) + '%'}
                      isSmall
                      flexDirection="row"
                      justifyContent="space-between"
                      gridGap="12px"
                    />
                  )}

                  <TradeSettings
                    isBull={true}
                    setBullSlippage={(s) => setSlippage(s.toNumber())}
                    bullSlippage={new BigNumber(slippage)}
                  />
                </Box>
              </Box>
              <Metric
                label="ETH to crab"
                value={quote.ethToCrab.toString()}
                isSmall
                flexDirection="row"
                justifyContent="space-between"
                gridGap="12px"
              />
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
              ) : isDeposit ? (
                <PrimaryButtonNew
                  fullWidth
                  id="bull-deposit-btn"
                  variant={'contained'}
                  onClick={onDepositClick}
                  disabled={quoteLoading}
                >
                  Deposit
                </PrimaryButtonNew>
              ) : (
                <PrimaryButtonNew fullWidth id="bull-withdraw-btn" variant={'contained'} disabled={false}>
                  Withdraw
                </PrimaryButtonNew>
              )}
            </Box>
          </div>
        </>
      )}
    </>
  )
}

export default BullTrade

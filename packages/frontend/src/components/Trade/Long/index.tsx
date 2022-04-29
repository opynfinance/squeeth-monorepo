import { CircularProgress, createStyles, makeStyles, Typography } from '@material-ui/core'
import ArrowRightAltIcon from '@material-ui/icons/ArrowRightAlt'
import RefreshOutlined from '@material-ui/icons/RefreshOutlined'
import BigNumber from 'bignumber.js'
import React, { useState } from 'react'
import { useResetAtom, useUpdateAtom } from 'jotai/utils'

import { BIG_ZERO, Links } from '../../../constants'
import { useUserAllowance } from '@hooks/contracts/useAllowance'
import { PrimaryButton } from '@components/Button'
import { PrimaryInput } from '@components/Input/PrimaryInput'
import { UniswapIframe } from '@components/Modal/UniswapIframe'
import { TradeSettings } from '@components/TradeSettings'
import Confirmed, { ConfirmType } from '../Confirmed'
import Cancelled from '../Cancelled'
import TradeInfoItem from '../TradeInfoItem'
import UniswapData from '../UniswapData'
import { connectedWalletAtom, isTransactionFirstStepAtom, supportedNetworkAtom } from 'src/state/wallet/atoms'
import { useSelectWallet, useTransactionStatus, useWalletBalance } from 'src/state/wallet/hooks'
import { useAtom, useAtomValue } from 'jotai'
import { addressesAtom, isShortAtom } from 'src/state/positions/atoms'
import { useETHPrice } from '@hooks/useETHPrice'
import {
  useBuyAndRefund,
  useGetBuyQuote,
  useGetBuyQuoteForETH,
  useGetSellQuote,
  useGetSellQuoteForETH,
  useGetWSqueethPositionValue,
  useSell,
} from 'src/state/squeethPool/hooks'
import { useComputeSwaps, useShortDebt } from 'src/state/positions/hooks'
import {
  confirmedAmountAtom,
  ethTradeAmountAtom,
  inputQuoteLoadingAtom,
  quoteAtom,
  slippageAmountAtom,
  sqthTradeAmountAtom,
  tradeCompletedAtom,
  tradeSuccessAtom,
  tradeTypeAtom,
} from 'src/state/trade/atoms'
import { toTokenAmount } from '@utils/calculations'
import { TradeType } from '../../../types'
import { currentImpliedFundingAtom, dailyHistoricalFundingAtom } from 'src/state/controller/atoms'
import useAppEffect from '@hooks/useAppEffect'
import useAppCallback from '@hooks/useAppCallback'
import useAppMemo from '@hooks/useAppMemo'

const useStyles = makeStyles((theme) =>
  createStyles({
    header: {
      color: theme.palette.primary.main,
    },
    body: {
      padding: theme.spacing(2, 12),
      margin: 'auto',
      display: 'flex',
      justifyContent: 'space-around',
    },
    subHeading: {
      color: theme.palette.text.secondary,
    },
    thirdHeading: {
      marginTop: theme.spacing(2),
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
    },
    explainer: {
      marginTop: theme.spacing(2),
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
      marginLeft: theme.spacing(1),
      width: '200px',
      justifyContent: 'left',
    },
    caption: {
      marginTop: theme.spacing(1),
      fontSize: '13px',
    },
    divider: {
      margin: theme.spacing(2, 0),
      width: '300px',
      marginLeft: 'auto',
      marginRight: 'auto',
    },
    details: {
      marginTop: theme.spacing(4),
      width: '65%',
    },
    buyCard: {
      marginTop: theme.spacing(4),
      marginLeft: theme.spacing(2),
    },
    cardTitle: {
      color: theme.palette.primary.main,
      marginTop: theme.spacing(4),
    },
    cardSubTxt: {
      color: theme.palette.text.secondary,
      lineHeight: '1.75rem',
      fontSize: '16px',
      width: '90%',
    },
    payoff: {
      color: theme.palette.text.secondary,
      lineHeight: '1.75rem',
      fontSize: '16px',
    },
    cardDetail: {
      color: theme.palette.text.secondary,
      lineHeight: '1.75rem',
      fontSize: '16px',
      marginTop: theme.spacing(4),
    },
    amountInput: {
      marginTop: theme.spacing(1),
      backgroundColor: theme.palette.success.main,
      '&:hover': {
        backgroundColor: theme.palette.success.dark,
      },
    },
    innerCard: {
      textAlign: 'center',
      padding: theme.spacing(2),
      paddingBottom: theme.spacing(8),
      background: theme.palette.background.default,
      border: `1px solid ${theme.palette.background.stone}`,
    },
    expand: {
      transform: 'rotate(270deg)',
      color: theme.palette.primary.main,
      transition: theme.transitions.create('transform', {
        duration: theme.transitions.duration.shortest,
      }),
      marginTop: theme.spacing(6),
    },
    expandOpen: {
      transform: 'rotate(180deg)',
      color: theme.palette.primary.main,
    },
    dialog: {
      padding: theme.spacing(2),
    },
    dialogHeader: {
      display: 'flex',
      alignItems: 'center',
    },
    dialogIcon: {
      marginRight: theme.spacing(1),
      color: theme.palette.warning.main,
    },
    txItem: {
      marginTop: theme.spacing(1),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoIcon: {
      marginLeft: theme.spacing(0.5),
      color: theme.palette.text.secondary,
    },
    squeethExp: {
      display: 'flex',
      justifyContent: 'space-between',
      borderRadius: theme.spacing(1),
      padding: theme.spacing(1.5),
      width: '300px',
      marginLeft: 'auto',
      marginRight: 'auto',
      marginTop: theme.spacing(2),
      textAlign: 'left',
      backgroundColor: theme.palette.background.stone,
    },
    squeethExpTxt: {
      fontSize: '20px',
    },
    closePosition: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: theme.spacing(0, 1),
    },
    closeBtn: {
      color: theme.palette.error.main,
    },
    paper: {
      backgroundColor: theme.palette.background.paper,
      boxShadow: theme.shadows[5],
      borderRadius: theme.spacing(1),
      width: '350px',
      textAlign: 'center',
      paddingBottom: theme.spacing(2),
    },
    modal: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDiv: {
      position: 'sticky',
      bottom: '0',
      background: '#2A2D2E',
      paddingBottom: theme.spacing(3),
    },
    hint: {
      display: 'flex',
      alignItems: 'center',
    },
    arrowIcon: {
      marginLeft: '4px',
      marginRight: '4px',
      fontSize: '20px',
    },
    hintTextContainer: {
      display: 'flex',
    },
    hintTitleText: {
      marginRight: '.5em',
    },
    linkHover: {
      '&:hover': {
        opacity: 0.7,
      },
    },
    anchor: {
      color: '#FF007A',
      fontSize: '16px',
    },
    settingsContainer: {
      display: 'flex',
      justify: 'space-between',
      alignItems: 'center',
    },
    settingsButton: {
      marginTop: theme.spacing(2),
      marginLeft: theme.spacing(10),
      justifyContent: 'right',
      alignSelf: 'center',
    },
    displayBlock: {
      display: 'block',
    },
    displayNone: {
      display: 'none',
    },
  }),
)

const OpenLong: React.FC<BuyProps> = ({ activeStep = 0, open }) => {
  const [buyLoading, setBuyLoading] = useState(false)
  const getBuyQuoteForETH = useGetBuyQuoteForETH()
  const getBuyQuote = useGetBuyQuote()
  const { data } = useWalletBalance()
  const balance = Number(toTokenAmount(data ?? BIG_ZERO, 18).toFixed(4))

  const classes = useStyles()
  const {
    cancelled,
    confirmed,
    loading: transactionInProgress,
    transactionData,
    resetTxCancelled,
    resetTransactionData,
  } = useTransactionStatus()
  const buyAndRefund = useBuyAndRefund()
  const getWSqueethPositionValue = useGetWSqueethPositionValue()
  const [confirmedAmount, setConfirmedAmount] = useAtom(confirmedAmountAtom)
  const [inputQuoteLoading, setInputQuoteLoading] = useAtom(inputQuoteLoadingAtom)
  const setTradeSuccess = useUpdateAtom(tradeSuccessAtom)
  const slippageAmount = useAtomValue(slippageAmountAtom)
  const ethPrice = useETHPrice()
  const tradeType = useAtomValue(tradeTypeAtom)

  const connected = useAtomValue(connectedWalletAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const isShort = useAtomValue(isShortAtom)
  const selectWallet = useSelectWallet()
  const { squeethAmount } = useComputeSwaps()
  const dailyHistoricalFunding = useAtomValue(dailyHistoricalFundingAtom)
  const currentImpliedFunding = useAtomValue(currentImpliedFundingAtom)

  const [ethTradeAmount, setEthTradeAmount] = useAtom(ethTradeAmountAtom)
  const [sqthTradeAmount, setSqthTradeAmount] = useAtom(sqthTradeAmountAtom)

  const [squeethExposure, setSqueethExposure] = useState(0)
  const [quote, setQuote] = useAtom(quoteAtom)

  const resetEthTradeAmount = useResetAtom(ethTradeAmountAtom)
  const resetSqthTradeAmount = useResetAtom(sqthTradeAmountAtom)
  const setTradeCompleted = useUpdateAtom(tradeCompletedAtom)

  useAppEffect(() => {
    if (open && tradeType === TradeType.LONG) {
      getBuyQuoteForETH(new BigNumber(sqthTradeAmount), slippageAmount).then((val) => {
        setQuote(val)
      })
    }
  }, [slippageAmount, sqthTradeAmount, getBuyQuoteForETH, open, setQuote, tradeType])

  const handleEthChange = useAppCallback(
    (value: string) => {
      setEthTradeAmount(value)
      setInputQuoteLoading(true)

      getBuyQuoteForETH(new BigNumber(value), slippageAmount).then((val) => {
        setSqthTradeAmount(val.amountOut.toString())
        setConfirmedAmount(val.amountOut.toFixed(6).toString())
        setSqueethExposure(Number(getWSqueethPositionValue(val.amountOut)))
        setInputQuoteLoading(false)
      })
    },
    [
      getBuyQuoteForETH,
      getWSqueethPositionValue,
      slippageAmount,
      setConfirmedAmount,
      setEthTradeAmount,
      setInputQuoteLoading,
      setSqthTradeAmount,
    ],
  )

  const handleSqthChange = useAppCallback(
    (value: string) => {
      setSqthTradeAmount(value)
      setInputQuoteLoading(true)

      getBuyQuote(new BigNumber(value), slippageAmount).then((val) => {
        setEthTradeAmount(val.amountIn.toString())

        setInputQuoteLoading(false)
      })
    },
    [getBuyQuote, slippageAmount, setEthTradeAmount, setInputQuoteLoading, setSqthTradeAmount],
  )

  let openError: string | undefined
  // let closeError: string | undefined
  let existingShortError: string | undefined
  let priceImpactWarning: string | undefined
  let highVolError: string | undefined

  if (connected) {
    // if (longSqthBal.lt(amount)) {
    //   closeError = 'Insufficient oSQTH balance'
    // }
    if (new BigNumber(ethTradeAmount).gt(balance)) {
      openError = 'Insufficient ETH balance'
    }
    if (isShort) {
      existingShortError = 'Close your short position to open a long'
    }
    if (new BigNumber(quote.priceImpact).gt(3)) {
      priceImpactWarning = 'High Price Impact'
    }
    if (currentImpliedFunding >= 1.75 * dailyHistoricalFunding.funding) {
      highVolError = `Current implied funding is 75% higher than the last ${dailyHistoricalFunding.period} hours. Consider if you want to purchase now or later`
    }
  }

  const longOpenPriceImpactErrorState = priceImpactWarning && !buyLoading && !openError && !isShort

  useAppEffect(() => {
    if (transactionInProgress) {
      setBuyLoading(false)
    }
  }, [transactionInProgress])

  const transact = useAppCallback(async () => {
    setBuyLoading(true)
    try {
      await buyAndRefund(new BigNumber(ethTradeAmount), () => {
        setTradeSuccess(true)
        setTradeCompleted(true)

        resetEthTradeAmount()
        resetSqthTradeAmount()
      })
    } catch (e) {
      console.log(e)
      setBuyLoading(false)
    }
  }, [buyAndRefund, ethTradeAmount, resetEthTradeAmount, resetSqthTradeAmount, setTradeCompleted, setTradeSuccess])

  return (
    <div id="open-long-card">
      {confirmed ? (
        <div>
          <Confirmed
            confirmationMessage={`Bought ${confirmedAmount} Squeeth`}
            txnHash={transactionData?.hash ?? ''}
            confirmType={ConfirmType.TRADE}
          />
          <div className={classes.buttonDiv}>
            <PrimaryButton
              id="open-long-close-btn"
              variant="contained"
              onClick={() => {
                resetTransactionData()
              }}
              className={classes.amountInput}
              style={{ width: '300px' }}
            >
              {'Close'}
            </PrimaryButton>
          </div>
        </div>
      ) : cancelled ? (
        <div>
          <Cancelled txnHash={transactionData?.hash ?? ''} />
          <div className={classes.buttonDiv}>
            <PrimaryButton
              variant="contained"
              onClick={() => {
                resetTransactionData()
                resetTxCancelled()
              }}
              className={classes.amountInput}
              style={{ width: '300px' }}
            >
              {'Close'}
            </PrimaryButton>
          </div>
        </div>
      ) : (
        <div>
          {activeStep === 0 ? (
            <>
              <div className={classes.settingsContainer}>
                <Typography variant="caption" className={classes.explainer} component="div" id="open-long-header-box">
                  Pay ETH to buy squeeth ERC20
                </Typography>
                <span className={classes.settingsButton}>
                  <TradeSettings />
                </span>
              </div>
              <div className={classes.thirdHeading} />
              <PrimaryInput
                value={ethTradeAmount}
                onChange={(v) => handleEthChange(v)}
                label="Amount"
                tooltip="Amount of ETH you want to spend to get Squeeth exposure"
                actionTxt="Max"
                onActionClicked={() => handleEthChange(balance.toString())}
                unit="ETH"
                convertedValue={new BigNumber(ethTradeAmount).times(ethPrice).toFixed(2).toLocaleString()}
                error={!!existingShortError || !!priceImpactWarning || !!openError || !!highVolError}
                isLoading={inputQuoteLoading}
                hint={
                  openError ? (
                    openError
                  ) : existingShortError ? (
                    existingShortError
                  ) : priceImpactWarning ? (
                    priceImpactWarning
                  ) : highVolError ? (
                    highVolError
                  ) : (
                    <div className={classes.hint}>
                      <span>
                        Balance <span id="open-long-eth-before-trade-balance">{balance.toFixed(4)}</span>
                      </span>
                      {new BigNumber(ethTradeAmount).toNumber() ? (
                        <>
                          <ArrowRightAltIcon className={classes.arrowIcon} />
                          <span id="open-long-eth-post-trade-balance">
                            {new BigNumber(balance).minus(new BigNumber(ethTradeAmount)).toFixed(6)}
                          </span>
                        </>
                      ) : null}{' '}
                      <span style={{ marginLeft: '4px' }}>ETH</span>
                    </div>
                  )
                }
                id="open-long-eth-input"
              />
              <PrimaryInput
                value={sqthTradeAmount}
                onChange={(v) => handleSqthChange(v)}
                label="Amount"
                tooltip="Amount of Squeeth exposure"
                actionTxt="Max"
                unit="oSQTH"
                convertedValue={getWSqueethPositionValue(new BigNumber(sqthTradeAmount)).toFixed(2).toLocaleString()}
                error={!!existingShortError || !!priceImpactWarning || !!openError}
                isLoading={inputQuoteLoading}
                hint={
                  openError ? (
                    openError
                  ) : existingShortError ? (
                    existingShortError
                  ) : priceImpactWarning ? (
                    priceImpactWarning
                  ) : highVolError ? (
                    highVolError
                  ) : (
                    <div className={classes.hint}>
                      <span className={classes.hintTextContainer}>
                        <span className={classes.hintTitleText}>Balance </span>
                        <span id="open-long-osqth-before-trade-balance">{squeethAmount.toFixed(4)}</span>
                      </span>
                      {quote.amountOut.gt(0) ? (
                        <>
                          <ArrowRightAltIcon className={classes.arrowIcon} />
                          <span id="open-long-osqth-post-trade-balance">
                            {squeethAmount.plus(new BigNumber(sqthTradeAmount)).toFixed(6)}
                          </span>{' '}
                        </>
                      ) : null}{' '}
                      <span style={{ marginLeft: '4px' }}>oSQTH</span>
                    </div>
                  )
                }
                id="open-long-osqth-input"
              />

              <div className={classes.divider}>
                <TradeInfoItem
                  label="Value if ETH up 2x"
                  value={Number((squeethExposure * 4).toFixed(2)).toLocaleString()}
                  tooltip="The value of your position if ETH goes up 2x, not including funding"
                  frontUnit="$"
                  id="open-short-eth-up-2x"
                />
                {/* if ETH down 50%, squeeth down 75%, so multiply amount by 0.25 to get what would remain  */}
                <TradeInfoItem
                  label="Value if ETH down 50%"
                  value={Number((squeethExposure * 0.25).toFixed(2)).toLocaleString()}
                  tooltip="The value of your position if ETH goes down 50%, not including funding"
                  frontUnit="$"
                  id="open-short-eth-down-50%"
                />
                <div style={{ marginTop: '10px' }}>
                  <UniswapData
                    slippage={isNaN(Number(slippageAmount)) ? '0' : slippageAmount.toString()}
                    priceImpact={quote.priceImpact}
                    minReceived={quote.minimumAmountOut.toFixed(6)}
                    minReceivedUnit="oSQTH"
                  />
                </div>
              </div>
              <div className={classes.buttonDiv}>
                {!connected ? (
                  <PrimaryButton
                    variant="contained"
                    onClick={selectWallet}
                    className={classes.amountInput}
                    disabled={!!buyLoading}
                    style={{ width: '300px' }}
                    id="open-long-connect-wallet-btn"
                  >
                    {'Connect Wallet'}
                  </PrimaryButton>
                ) : (
                  <PrimaryButton
                    variant={longOpenPriceImpactErrorState || !!highVolError ? 'outlined' : 'contained'}
                    onClick={transact}
                    className={classes.amountInput}
                    disabled={
                      !supportedNetwork ||
                      !!buyLoading ||
                      transactionInProgress ||
                      !!openError ||
                      !!existingShortError ||
                      sqthTradeAmount === '0'
                    }
                    style={
                      longOpenPriceImpactErrorState || !!highVolError
                        ? { width: '300px', color: '#f5475c', backgroundColor: 'transparent', borderColor: '#f5475c' }
                        : { width: '300px' }
                    }
                    id="open-long-submit-tx-btn"
                  >
                    {!supportedNetwork ? (
                      'Unsupported Network'
                    ) : buyLoading || transactionInProgress ? (
                      <CircularProgress color="primary" size="1.5rem" />
                    ) : longOpenPriceImpactErrorState ? (
                      'Buy Anyway'
                    ) : (
                      'Buy'
                    )}
                  </PrimaryButton>
                )}
                <Typography variant="caption" className={classes.caption} component="div">
                  <a href={Links.UniswapSwap} target="_blank" rel="noreferrer">
                    {' '}
                    Trades on Uniswap V3 🦄{' '}
                  </a>
                </Typography>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
              <UniswapIframe />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const CloseLong: React.FC<BuyProps> = () => {
  const [sellLoading, setSellLoading] = useState(false)
  const [hasJustApprovedSqueeth, setHasJustApprovedSqueeth] = useState(false)

  const classes = useStyles()
  const {
    cancelled,
    confirmed,
    loading: transactionInProgress,
    transactionData,
    resetTxCancelled,
    resetTransactionData,
  } = useTransactionStatus()
  const { swapRouter, oSqueeth } = useAtomValue(addressesAtom)
  const sell = useSell()
  const getWSqueethPositionValue = useGetWSqueethPositionValue()
  const getSellQuoteForETH = useGetSellQuoteForETH()
  const getSellQuote = useGetSellQuote()
  const { data } = useWalletBalance()
  const balance = Number(toTokenAmount(data ?? BIG_ZERO, 18).toFixed(4))

  const [confirmedAmount, setConfirmedAmount] = useAtom(confirmedAmountAtom)
  const [inputQuoteLoading, setInputQuoteLoading] = useAtom(inputQuoteLoadingAtom)
  const [quote, setQuote] = useAtom(quoteAtom)
  const [ethTradeAmount, setEthTradeAmount] = useAtom(ethTradeAmountAtom)
  const [sqthTradeAmount, setSqthTradeAmount] = useAtom(sqthTradeAmountAtom)
  const setTradeSuccess = useUpdateAtom(tradeSuccessAtom)
  const setTradeCompleted = useUpdateAtom(tradeCompletedAtom)
  const slippageAmount = useAtomValue(slippageAmountAtom)
  const ethPrice = useETHPrice()
  const amount = useAppMemo(() => new BigNumber(sqthTradeAmount), [sqthTradeAmount])
  const altTradeAmount = new BigNumber(ethTradeAmount)
  const { allowance: squeethAllowance, approve: squeethApprove } = useUserAllowance(oSqueeth, swapRouter)
  const [isTxFirstStep, setIsTxFirstStep] = useAtom(isTransactionFirstStepAtom)

  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const connected = useAtomValue(connectedWalletAtom)
  const selectWallet = useSelectWallet()
  const { squeethAmount } = useComputeSwaps()

  const shortDebt = useShortDebt()
  const isShort = shortDebt.gt(0)

  const resetEthTradeAmount = useResetAtom(ethTradeAmountAtom)
  const resetSqthTradeAmount = useResetAtom(sqthTradeAmountAtom)

  useAppEffect(() => {
    //if it's insufficient amount them set it to it's maximum
    if (squeethAmount.lt(amount)) {
      setSqthTradeAmount(squeethAmount.toString())
      getSellQuoteForETH(squeethAmount).then((val) => {
        setEthTradeAmount(val.amountIn.toString())
        setConfirmedAmount(val.amountIn.toFixed(6).toString())
      })
    }
  }, [squeethAmount, amount, getSellQuoteForETH, setConfirmedAmount, setEthTradeAmount, setSqthTradeAmount])

  // let openError: string | undefined
  let closeError: string | undefined
  let existingShortError: string | undefined
  let priceImpactWarning: string | undefined

  if (connected) {
    if (squeethAmount.lt(amount)) {
      closeError = 'Insufficient oSQTH balance'
    }
    // if (amount.gt(balance)) {
    //   openError = 'Insufficient ETH balance'
    // }
    if (isShort) {
      existingShortError = 'Close your short position to open a long'
    }
    if (new BigNumber(quote.priceImpact).gt(3)) {
      priceImpactWarning = 'High Price Impact'
    }
  }

  const longClosePriceImpactErrorState =
    priceImpactWarning && !closeError && !sellLoading && !squeethAmount.isZero() && !isShort

  const sellAndClose = useAppCallback(async () => {
    setSellLoading(true)
    try {
      if (squeethAllowance.lt(amount)) {
        setIsTxFirstStep(true)
        await squeethApprove(() => {
          setHasJustApprovedSqueeth(true)
          setSellLoading(false)
        })
      } else {
        await sell(amount, () => {
          setIsTxFirstStep(false)
          setTradeSuccess(true)
          setTradeCompleted(true)

          resetEthTradeAmount()
          resetSqthTradeAmount()
        })
      }
    } catch (e) {
      console.log(e)
      setSellLoading(false)
    }
  }, [
    amount,
    resetEthTradeAmount,
    resetSqthTradeAmount,
    sell,
    setIsTxFirstStep,
    setTradeCompleted,
    setTradeSuccess,
    squeethAllowance,
    squeethApprove,
  ])

  useAppEffect(() => {
    if (transactionInProgress) {
      setSellLoading(false)
    }
  }, [transactionInProgress])

  useAppEffect(() => {
    getSellQuote(new BigNumber(sqthTradeAmount), slippageAmount).then((val) => {
      setQuote(val)
    })
  }, [slippageAmount, sqthTradeAmount, getSellQuote, setQuote])

  const handleSqthChange = useAppCallback(
    (value: string) => {
      setInputQuoteLoading(true)
      setSqthTradeAmount(value)
      getSellQuote(new BigNumber(value), slippageAmount).then((val) => {
        if (value !== '0') setConfirmedAmount(Number(value).toFixed(6))
        setEthTradeAmount(val.amountOut.toString())
        setInputQuoteLoading(false)
      })
    },
    [getSellQuote, slippageAmount, setConfirmedAmount, setEthTradeAmount, setInputQuoteLoading, setSqthTradeAmount],
  )

  const handleEthChange = useAppCallback(
    (value: string) => {
      setInputQuoteLoading(true)
      setEthTradeAmount(value)
      getSellQuoteForETH(new BigNumber(value), slippageAmount).then((val) => {
        if (value !== '0') setConfirmedAmount(val.amountIn.toFixed(6).toString())
        setSqthTradeAmount(val.amountIn.toString())
        setInputQuoteLoading(false)
      })
    },
    [
      getSellQuoteForETH,
      slippageAmount,
      setConfirmedAmount,
      setEthTradeAmount,
      setInputQuoteLoading,
      setSqthTradeAmount,
    ],
  )

  return (
    <div id="close-long-card">
      {confirmed && !isTxFirstStep ? (
        <div>
          <Confirmed
            confirmationMessage={`Sold ${confirmedAmount} Squeeth`}
            txnHash={transactionData?.hash ?? ''}
            confirmType={ConfirmType.TRADE}
          />
          <div className={classes.buttonDiv}>
            <PrimaryButton
              id="close-long-close-btn"
              variant="contained"
              onClick={() => {
                resetTransactionData()
              }}
              className={classes.amountInput}
              style={{ width: '300px' }}
            >
              {'Close'}
            </PrimaryButton>
          </div>
        </div>
      ) : cancelled ? (
        <div>
          <Cancelled txnHash={transactionData?.hash ?? ''} />
          <div className={classes.buttonDiv}>
            <PrimaryButton
              variant="contained"
              onClick={() => {
                resetTransactionData()
                resetTxCancelled()
              }}
              className={classes.amountInput}
              style={{ width: '300px' }}
            >
              {'Close'}
            </PrimaryButton>
          </div>
        </div>
      ) : (
        <div>
          <div className={classes.settingsContainer} id="close-long-header-box">
            <Typography variant="caption" className={classes.explainer} component="div">
              Sell squeeth ERC20 to get ETH
            </Typography>
            <span className={classes.settingsButton}>
              <TradeSettings />
            </span>
          </div>

          <div className={classes.thirdHeading} />
          <PrimaryInput
            value={sqthTradeAmount}
            onChange={(v) => handleSqthChange(v)}
            label="Amount"
            tooltip="Amount of oSqueeth you want to close"
            actionTxt="Max"
            onActionClicked={() => handleSqthChange(squeethAmount.toString())}
            unit="oSQTH"
            convertedValue={getWSqueethPositionValue(amount).toFixed(2).toLocaleString()}
            error={!!existingShortError || !!priceImpactWarning || !!closeError}
            isLoading={inputQuoteLoading}
            hint={
              existingShortError ? (
                existingShortError
              ) : closeError ? (
                closeError
              ) : priceImpactWarning ? (
                priceImpactWarning
              ) : (
                <div className={classes.hint}>
                  <span className={classes.hintTextContainer}>
                    <span className={classes.hintTitleText}>Position</span>{' '}
                    <span id="close-long-osqth-before-trade-balance">{squeethAmount.toFixed(6)}</span>{' '}
                  </span>
                  {quote.amountOut.gt(0) ? (
                    <>
                      <ArrowRightAltIcon className={classes.arrowIcon} />
                      <span id="close-long-osqth-post-trade-balance">{squeethAmount.minus(amount).toFixed(6)}</span>
                    </>
                  ) : null}{' '}
                  <span style={{ marginLeft: '4px' }}>oSQTH</span>
                </div>
              )
            }
            id="close-long-osqth-input"
          />
          <PrimaryInput
            value={ethTradeAmount}
            onChange={(v) => handleEthChange(v)}
            label="Amount"
            tooltip="Amount of oSqueeth you want to close in eth"
            unit="ETH"
            convertedValue={altTradeAmount.times(ethPrice).toFixed(2).toLocaleString()}
            error={!!existingShortError || !!priceImpactWarning || !!closeError}
            isLoading={inputQuoteLoading}
            hint={
              existingShortError ? (
                existingShortError
              ) : closeError ? (
                closeError
              ) : priceImpactWarning ? (
                priceImpactWarning
              ) : (
                <div className={classes.hint}>
                  <span>
                    Balance <span id="close-long-eth-before-trade-balance">{balance}</span>{' '}
                  </span>{' '}
                  {amount.toNumber() ? (
                    <>
                      <ArrowRightAltIcon className={classes.arrowIcon} />
                      <span id="close-long-eth-post-trade-balance">
                        {new BigNumber(balance).plus(altTradeAmount).toFixed(4)}
                      </span>
                    </>
                  ) : null}{' '}
                  <span style={{ marginLeft: '4px' }}>ETH</span>
                </div>
              )
            }
            id="close-long-eth-input"
          />
          <div className={classes.divider}>
            <UniswapData
              slippage={isNaN(Number(slippageAmount)) ? '0' : slippageAmount.toString()}
              priceImpact={quote.priceImpact}
              minReceived={quote.minimumAmountOut.toFixed(4)}
              minReceivedUnit="ETH"
            />
          </div>
          <div className={classes.buttonDiv}>
            {!connected ? (
              <PrimaryButton
                variant="contained"
                onClick={selectWallet}
                className={classes.amountInput}
                disabled={!!sellLoading}
                style={{ width: '300px' }}
                id="close-long-connect-wallet-btn"
              >
                {'Connect Wallet'}
              </PrimaryButton>
            ) : (
              <PrimaryButton
                variant={longClosePriceImpactErrorState ? 'outlined' : 'contained'}
                onClick={sellAndClose}
                className={classes.amountInput}
                disabled={
                  !supportedNetwork ||
                  !!sellLoading ||
                  transactionInProgress ||
                  !!closeError ||
                  !!existingShortError ||
                  squeethAmount.isZero() ||
                  sqthTradeAmount === '0'
                }
                style={
                  longClosePriceImpactErrorState
                    ? { width: '300px', color: '#f5475c', backgroundColor: 'transparent', borderColor: '#f5475c' }
                    : { width: '300px' }
                }
                id="close-long-submit-tx-btn"
              >
                {!supportedNetwork ? (
                  'Unsupported Network'
                ) : sellLoading || transactionInProgress ? (
                  <CircularProgress color="primary" size="1.5rem" />
                ) : squeethAllowance.lt(amount) ? (
                  'Approve oSQTH (1/2)'
                ) : longClosePriceImpactErrorState ? (
                  'Sell Anyway'
                ) : hasJustApprovedSqueeth ? (
                  'Sell to close (2/2)'
                ) : (
                  'Sell to close'
                )}
              </PrimaryButton>
            )}
            <Typography variant="caption" className={classes.caption} component="div">
              <a href={Links.UniswapSwap} target="_blank" rel="noreferrer">
                {' '}
                Trades on Uniswap V3 🦄{' '}
              </a>
            </Typography>
          </div>
        </div>
      )}
    </div>
  )
}

type BuyProps = {
  open?: boolean
  isLPage?: boolean
  activeStep?: number
}

const Long: React.FC<BuyProps> = ({ open, isLPage = false, activeStep = 0 }) => {
  return open ? (
    <OpenLong open={open} isLPage={isLPage} activeStep={activeStep} />
  ) : (
    <CloseLong isLPage={isLPage} activeStep={activeStep} />
  )
}

export default Long

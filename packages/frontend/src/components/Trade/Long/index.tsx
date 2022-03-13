import { CircularProgress, createStyles, makeStyles, Typography } from '@material-ui/core'
import ArrowRightAltIcon from '@material-ui/icons/ArrowRightAlt'
import BigNumber from 'bignumber.js'
import React, { useCallback, useEffect, useState } from 'react'
import { useResetAtom, useUpdateAtom } from 'jotai/utils'

import { BIG_ZERO, Links } from '../../../constants'
import { useUserAllowance } from '@hooks/contracts/useAllowance'
import { PrimaryButton } from '@components/Button'
import { PrimaryInput } from '@components/Input/PrimaryInput'
import { UniswapIframe } from '@components/Modal/UniswapIframe'
import { TradeSettings } from '@components/TradeSettings'
import Confirmed, { ConfirmType } from '../Confirmed'
import TradeInfoItem from '../TradeInfoItem'
import UniswapData from '../UniswapData'
import { connectedWalletAtom } from 'src/state/wallet/atoms'
import { useSelectWallet, useWalletBalance } from 'src/state/wallet/hooks'
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
import { useComputeSwaps, useLongSqthBal, useShortDebt } from 'src/state/positions/hooks'
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
  transactionHashAtom,
} from 'src/state/trade/atoms'
import { toTokenAmount } from '@utils/calculations'
import { useDailyHistoricalFunding, useCurrentImpliedFunding } from 'src/state/controller/hooks'
import { TradeType } from '../../../types'

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
  // const [confirmed, setConfirmed] = useState(false)
  // const [txHash, setTxHash] = useState('')
  const getBuyQuoteForETH = useGetBuyQuoteForETH()
  const getBuyQuote = useGetBuyQuote()
  const { data } = useWalletBalance()
  const balance = Number(toTokenAmount(data ?? BIG_ZERO, 18).toFixed(4))

  const classes = useStyles()
  const buyAndRefund = useBuyAndRefund()
  const getWSqueethPositionValue = useGetWSqueethPositionValue()
  const [confirmedAmount, setConfirmedAmount] = useAtom(confirmedAmountAtom)
  const [inputQuoteLoading, setInputQuoteLoading] = useAtom(inputQuoteLoadingAtom)
  const setTradeSuccess = useUpdateAtom(tradeSuccessAtom)
  const slippageAmount = useAtomValue(slippageAmountAtom)
  const ethPrice = useETHPrice()
  const tradeType = useAtomValue(tradeTypeAtom)

  const txHash = useAtomValue(transactionHashAtom)
  const resetTxHash = useResetAtom(transactionHashAtom)
  const confirmed = Boolean(txHash)

  const connected = useAtomValue(connectedWalletAtom)
  const isShort = useAtomValue(isShortAtom)
  const selectWallet = useSelectWallet()
  const { squeethAmount } = useComputeSwaps()
  const longSqthBal = useLongSqthBal()
  const dailyHistoricalFunding = useDailyHistoricalFunding()
  const currentImpliedFunding = useCurrentImpliedFunding()

  const [ethTradeAmount, setEthTradeAmount] = useAtom(ethTradeAmountAtom)
  const [sqthTradeAmount, setSqthTradeAmount] = useAtom(sqthTradeAmountAtom)

  const [squeethExposure, setSqueethExposure] = useState(0)
  const [quote, setQuote] = useAtom(quoteAtom)

  const resetEthTradeAmount = useResetAtom(ethTradeAmountAtom)
  const resetSqthTradeAmount = useResetAtom(sqthTradeAmountAtom)
  const setTradeCompleted = useUpdateAtom(tradeCompletedAtom)

  useEffect(() => {
    if (open && tradeType === TradeType.LONG) {
      getBuyQuoteForETH(new BigNumber(sqthTradeAmount), slippageAmount).then((val) => {
        setQuote(val)
      })
    }
  }, [slippageAmount.toString(), sqthTradeAmount])

  const handleEthChange = (value: string) => {
    setEthTradeAmount(value)
    setInputQuoteLoading(true)

    getBuyQuoteForETH(new BigNumber(value), slippageAmount).then((val) => {
      setSqthTradeAmount(val.amountOut.toString())
      setConfirmedAmount(val.amountOut.toFixed(6).toString())
      setSqueethExposure(Number(getWSqueethPositionValue(val.amountOut)))
      setInputQuoteLoading(false)
    })
  }

  const handleSqthChange = (value: string) => {
    setSqthTradeAmount(value)
    setInputQuoteLoading(true)

    getBuyQuote(new BigNumber(value), slippageAmount).then((val) => {
      setEthTradeAmount(val.amountIn.toString())

      setInputQuoteLoading(false)
    })
  }

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

  const transact = async () => {
    setBuyLoading(true)
    try {
      await buyAndRefund(new BigNumber(ethTradeAmount))
      // setConfirmed(true)
      // setTxHash(confirmedHash.transactionHash)
      setTradeSuccess(true)
      setTradeCompleted(true)

      resetEthTradeAmount()
      resetSqthTradeAmount()
    } catch (e) {
      console.log(e)
    }
    setBuyLoading(false)
  }

  return (
    <div className={open ? classes.displayBlock : classes.displayNone}>
      {!confirmed ? (
        <div>
          {activeStep === 0 ? (
            <>
              <div className={classes.settingsContainer}>
                <Typography variant="caption" className={classes.explainer} component="div">
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
                      <span>{`Balance ${balance.toFixed(4)}`}</span>
                      {new BigNumber(ethTradeAmount).toNumber() ? (
                        <>
                          <ArrowRightAltIcon className={classes.arrowIcon} />
                          <span>{new BigNumber(balance).minus(new BigNumber(ethTradeAmount)).toFixed(6)}</span>
                        </>
                      ) : null}{' '}
                      <span style={{ marginLeft: '4px' }}>ETH</span>
                    </div>
                  )
                }
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
                        <span>{squeethAmount.toFixed(4)}</span>
                      </span>
                      {quote.amountOut.gt(0) ? (
                        <>
                          <ArrowRightAltIcon className={classes.arrowIcon} />
                          <span>{longSqthBal.plus(new BigNumber(sqthTradeAmount)).toFixed(6)}</span>
                        </>
                      ) : null}{' '}
                      <span style={{ marginLeft: '4px' }}>oSQTH</span>
                    </div>
                  )
                }
              />

              <div className={classes.divider}>
                <TradeInfoItem
                  label="Value if ETH up 2x"
                  value={Number((squeethExposure * 4).toFixed(2)).toLocaleString()}
                  tooltip="The value of your position if ETH goes up 2x, not including funding"
                  frontUnit="$"
                />
                {/* if ETH down 50%, squeeth down 75%, so multiply amount by 0.25 to get what would remain  */}
                <TradeInfoItem
                  label="Value if ETH down 50%"
                  value={Number((squeethExposure * 0.25).toFixed(2)).toLocaleString()}
                  tooltip="The value of your position if ETH goes down 50%, not including funding"
                  frontUnit="$"
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
                  >
                    {'Connect Wallet'}
                  </PrimaryButton>
                ) : (
                  <PrimaryButton
                    variant={longOpenPriceImpactErrorState || !!highVolError ? 'outlined' : 'contained'}
                    onClick={transact}
                    className={classes.amountInput}
                    disabled={!!buyLoading || !!openError || !!existingShortError}
                    style={
                      longOpenPriceImpactErrorState || !!highVolError
                        ? { width: '300px', color: '#f5475c', backgroundColor: 'transparent', borderColor: '#f5475c' }
                        : { width: '300px' }
                    }
                  >
                    {buyLoading ? (
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
      ) : (
        <div>
          <Confirmed
            confirmationMessage={`Bought ${confirmedAmount} Squeeth`}
            txnHash={txHash}
            confirmType={ConfirmType.TRADE}
          />
          <div className={classes.buttonDiv}>
            <PrimaryButton
              variant="contained"
              onClick={() => {
                resetTxHash()
                // setConfirmed(false)
              }}
              className={classes.amountInput}
              style={{ width: '300px' }}
            >
              {'Close'}
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  )
}

const CloseLong: React.FC<BuyProps> = ({ open }) => {
  const [sellLoading, setSellLoading] = useState(false)
  // const [confirmed, setConfirmed] = useState(false)
  // const [txHash, setTxHash] = useState('')
  const [hasJustApprovedSqueeth, setHasJustApprovedSqueeth] = useState(false)

  const classes = useStyles()
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
  const tradeType = useAtomValue(tradeTypeAtom)
  const ethPrice = useETHPrice()
  const amount = new BigNumber(sqthTradeAmount)
  const altTradeAmount = new BigNumber(ethTradeAmount)
  const { allowance: squeethAllowance, approve: squeethApprove } = useUserAllowance(oSqueeth, swapRouter)

  const txHash = useAtomValue(transactionHashAtom)
  const resetTxHash = useResetAtom(transactionHashAtom)
  const confirmed = Boolean(txHash)

  const connected = useAtomValue(connectedWalletAtom)
  const selectWallet = useSelectWallet()

  const longSqthBal = useLongSqthBal()
  const shortDebt = useShortDebt()
  const isShort = shortDebt.gt(0)

  const resetEthTradeAmount = useResetAtom(ethTradeAmountAtom)
  const resetSqthTradeAmount = useResetAtom(sqthTradeAmountAtom)

  useEffect(() => {
    //if it's insufficient amount them set it to it's maximum
    if (!open && tradeType === TradeType.LONG && longSqthBal.lt(amount)) {
      setSqthTradeAmount(longSqthBal.toString())
      getSellQuoteForETH(longSqthBal).then((val) => {
        setEthTradeAmount(val.amountIn.toString())
        setConfirmedAmount(val.amountIn.toFixed(6).toString())
      })
    }
  }, [longSqthBal.toString(), open, tradeType])

  // let openError: string | undefined
  let closeError: string | undefined
  let existingShortError: string | undefined
  let priceImpactWarning: string | undefined

  useEffect(() => {
    if (connected) {
      if (longSqthBal.lt(amount)) {
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
  }, [longSqthBal.toString(), amount.toString(), balance, isShort, quote.priceImpact])

  const longClosePriceImpactErrorState =
    priceImpactWarning && !closeError && !sellLoading && !longSqthBal.isZero() && !isShort

  const sellAndClose = useCallback(async () => {
    setSellLoading(true)
    try {
      if (squeethAllowance.lt(amount)) {
        await squeethApprove()
        setHasJustApprovedSqueeth(true)
      } else {
        await sell(amount)
        // setConfirmed(true)
        // setTxHash(confirmedHash.transactionHash)
        setTradeSuccess(true)
        setTradeCompleted(true)

        resetEthTradeAmount()
        resetSqthTradeAmount()
      }
    } catch (e) {
      console.log(e)
    }

    setSellLoading(false)
  }, [amount.toString(), squeethAllowance.toString(), longSqthBal.toString(), sell, squeethApprove])

  useEffect(() => {
    if (!open && tradeType === TradeType.LONG) {
      getSellQuote(new BigNumber(sqthTradeAmount), slippageAmount).then((val) => {
        setQuote(val)
      })
    }
  }, [slippageAmount.toString(), sqthTradeAmount, tradeType, open])

  const handleSqthChange = (value: string) => {
    setInputQuoteLoading(true)
    setSqthTradeAmount(value)
    getSellQuote(new BigNumber(value), slippageAmount).then((val) => {
      if (value !== '0') setConfirmedAmount(Number(value).toFixed(6))
      setEthTradeAmount(val.amountOut.toString())
      setInputQuoteLoading(false)
    })
  }

  const handleEthChange = (value: string) => {
    setInputQuoteLoading(true)
    setEthTradeAmount(value)
    getSellQuoteForETH(new BigNumber(value), slippageAmount).then((val) => {
      if (value !== '0') setConfirmedAmount(val.amountIn.toFixed(6).toString())
      setSqthTradeAmount(val.amountIn.toString())
      setInputQuoteLoading(false)
    })
  }

  return (
    <div className={!open ? classes.displayBlock : classes.displayNone}>
      {!confirmed ? (
        <div>
          <div className={classes.settingsContainer}>
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
            onActionClicked={() => handleSqthChange(longSqthBal.toString())}
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
                    <span className={classes.hintTitleText}>Position</span> <span>{longSqthBal.toFixed(6)}</span>
                  </span>
                  {quote.amountOut.gt(0) ? (
                    <>
                      <ArrowRightAltIcon className={classes.arrowIcon} />
                      <span>{longSqthBal.minus(amount).toFixed(6)}</span>
                    </>
                  ) : null}{' '}
                  <span style={{ marginLeft: '4px' }}>oSQTH</span>
                </div>
              )
            }
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
                  <span>{`Balance ${balance}`}</span>
                  {amount.toNumber() ? (
                    <>
                      <ArrowRightAltIcon className={classes.arrowIcon} />
                      <span>{new BigNumber(balance).plus(altTradeAmount).toFixed(4)}</span>
                    </>
                  ) : null}{' '}
                  <span style={{ marginLeft: '4px' }}>ETH</span>
                </div>
              )
            }
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
              >
                {'Connect Wallet'}
              </PrimaryButton>
            ) : (
              <PrimaryButton
                variant={longClosePriceImpactErrorState ? 'outlined' : 'contained'}
                onClick={sellAndClose}
                className={classes.amountInput}
                disabled={!!sellLoading || !!closeError || !!existingShortError || longSqthBal.isZero()}
                style={
                  longClosePriceImpactErrorState
                    ? { width: '300px', color: '#f5475c', backgroundColor: 'transparent', borderColor: '#f5475c' }
                    : { width: '300px' }
                }
              >
                {sellLoading ? (
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
      ) : (
        <div>
          <Confirmed
            confirmationMessage={`Sold ${confirmedAmount} Squeeth`}
            txnHash={txHash}
            confirmType={ConfirmType.TRADE}
          />
          <div className={classes.buttonDiv}>
            <PrimaryButton
              variant="contained"
              onClick={() => {
                resetTxHash()
                // setConfirmed(false)
              }}
              className={classes.amountInput}
              style={{ width: '300px' }}
            >
              {'Close'}
            </PrimaryButton>
          </div>
        </div>
      )}
    </div>
  )
}

type BuyProps = {
  // balance: number
  open: boolean
  // closeTitle: string
  isLPage?: boolean
  activeStep?: number
  // setTradeCompleted?: any
}

const Long: React.FC<BuyProps> = ({ open, isLPage = false, activeStep = 0 }) => {
  return (
    <>
      <OpenLong open={open} isLPage={isLPage} activeStep={activeStep} />

      <CloseLong open={open} isLPage={isLPage} activeStep={activeStep} />
    </>
  )
}

export default Long

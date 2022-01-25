import { CircularProgress, createStyles, makeStyles, Typography } from '@material-ui/core'
import ArrowRightAltIcon from '@material-ui/icons/ArrowRightAlt'
import BigNumber from 'bignumber.js'
import React, { useCallback, useEffect, useState } from 'react'

import { InputType, Links } from '../../../constants'
import { useTrade } from '@context/trade'
import { useWorldContext } from '@context/world'
import { useWallet } from '@context/wallet'
import { useUserAllowance } from '@hooks/contracts/useAllowance'
import { useSqueethPool } from '@hooks/contracts/useSqueethPool'
import { useAddresses } from '@hooks/useAddress'
import { usePositions } from '@context/positions'
import { PrimaryButton } from '@components/Button'
import { PrimaryInput } from '@components/Input/PrimaryInput'
import { UniswapIframe } from '@components/Modal/UniswapIframe'
import { TradeSettings } from '@components/TradeSettings'
import Confirmed, { ConfirmType } from '../Confirmed'
import TradeInfoItem from '../TradeInfoItem'
import UniswapData from '../UniswapData'

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
  }),
)

const OpenLong: React.FC<BuyProps> = ({ balance, setTradeCompleted, activeStep = 0 }) => {
  const [buyLoading, setBuyLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [txHash, setTxHash] = useState('')

  const classes = useStyles()
  const { buyAndRefund, getWSqueethPositionValue } = useSqueethPool()
  const {
    tradeAmount: amountInputValue,
    setTradeAmount: setAmount,
    squeethExposure,
    inputQuoteLoading,
    setInputQuoteLoading,
    setInputType,
    quote,
    altTradeAmount: altAmountInputValue,
    setAltTradeAmount,
    confirmedAmount,
    setTradeSuccess,
    slippageAmount,
  } = useTrade()
  const { ethPrice } = useWorldContext()
  const amount = new BigNumber(amountInputValue)
  const altTradeAmount = new BigNumber(altAmountInputValue)
  const { selectWallet, connected } = useWallet()
  const { squeethAmount, longSqthBal, isShort } = usePositions()

  let openError: string | undefined
  // let closeError: string | undefined
  let existingShortError: string | undefined
  let priceImpactWarning: string | undefined

  if (connected) {
    // if (longSqthBal.lt(amount)) {
    //   closeError = 'Insufficient oSQTH balance'
    // }
    if (amount.gt(balance)) {
      openError = 'Insufficient ETH balance'
    }
    if (isShort) {
      existingShortError = 'Close your short position to open a long'
    }
    if (new BigNumber(quote.priceImpact).gt(3)) {
      priceImpactWarning = 'High Price Impact'
    }
  }

  const longOpenPriceImpactErrorState = priceImpactWarning && !buyLoading && !openError && !isShort

  const transact = async () => {
    setBuyLoading(true)
    try {
      const confirmedHash = await buyAndRefund(amount)
      setConfirmed(true)
      setTxHash(confirmedHash.transactionHash)
      setTradeSuccess(true)
      setTradeCompleted(true)
    } catch (e) {
      console.log(e)
    }
    setBuyLoading(false)
  }

  const handleOpenDualInputUpdate = (v: string, currentInput: InputType) => {
    //If I'm inputting an amount of ETH I'd like to spend to get squeeth, use getBuyQuoteForETH in trade context
    //set eth amt and input type here,
    //and set quote, loading state and squth amount in trade context
    // if user enter same input then set input quote loading to false and then return
    if (currentInput === InputType.ETH) {
      if (v === amountInputValue) return
      setInputType(InputType.ETH)
      setAmount(v)
    } else {
      if (v === altAmountInputValue) return
      //If I'm inputting an amount of squeeth I'd like to buy with ETH, use getBuyQuote in trade context
      //set squth amt and input type here,
      //set quote, loading state and eth amount in trade context
      setInputType(InputType.SQTH)
      setAltTradeAmount(v)
    }
    setInputQuoteLoading(true)
  }

  return (
    <div>
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
                value={amountInputValue}
                onChange={(v) => handleOpenDualInputUpdate(v, InputType.ETH)}
                label="Amount"
                tooltip="Amount of ETH you want to spend to get Squeeth exposure"
                actionTxt="Max"
                onActionClicked={() => handleOpenDualInputUpdate(balance.toString(), InputType.ETH)}
                unit="ETH"
                convertedValue={amount.times(ethPrice).toFixed(2).toLocaleString()}
                error={!!existingShortError || !!priceImpactWarning || !!openError}
                isLoading={inputQuoteLoading}
                hint={
                  openError ? (
                    openError
                  ) : existingShortError ? (
                    existingShortError
                  ) : priceImpactWarning ? (
                    priceImpactWarning
                  ) : (
                    <div className={classes.hint}>
                      <span>{`Balance ${balance.toFixed(4)}`}</span>
                      {amount.toNumber() ? (
                        <>
                          <ArrowRightAltIcon className={classes.arrowIcon} />
                          <span>{new BigNumber(balance).minus(amount).toFixed(6)}</span>
                        </>
                      ) : null}{' '}
                      <span style={{ marginLeft: '4px' }}>ETH</span>
                    </div>
                  )
                }
              />
              <PrimaryInput
                value={altAmountInputValue}
                onChange={(v) => handleOpenDualInputUpdate(v, InputType.SQTH)}
                label="Amount"
                tooltip="Amount of Squeeth exposure"
                actionTxt="Max"
                unit="oSQTH"
                convertedValue={getWSqueethPositionValue(altTradeAmount).toFixed(2).toLocaleString()}
                error={!!existingShortError || !!priceImpactWarning || !!openError}
                isLoading={inputQuoteLoading}
                hint={
                  openError ? (
                    openError
                  ) : existingShortError ? (
                    existingShortError
                  ) : priceImpactWarning ? (
                    priceImpactWarning
                  ) : (
                    <div className={classes.hint}>
                      <span className={classes.hintTextContainer}>
                        <span className={classes.hintTitleText}>Balance </span>
                        <span>{squeethAmount.toFixed(4)}</span>
                      </span>
                      {quote.amountOut.gt(0) ? (
                        <>
                          <ArrowRightAltIcon className={classes.arrowIcon} />
                          <span>{longSqthBal.plus(quote.amountOut).toFixed(6)}</span>
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
                    variant={longOpenPriceImpactErrorState ? 'outlined' : 'contained'}
                    onClick={transact}
                    className={classes.amountInput}
                    disabled={!!buyLoading || !!openError || !!existingShortError}
                    style={
                      longOpenPriceImpactErrorState
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
              onClick={() => setConfirmed(false)}
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

const CloseLong: React.FC<BuyProps> = ({ balance, open, closeTitle, setTradeCompleted }) => {
  const [sellLoading, setSellLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [hasJustApprovedSqueeth, setHasJustApprovedSqueeth] = useState(false)

  const classes = useStyles()
  const { swapRouter, oSqueeth } = useAddresses()
  const { sell, getWSqueethPositionValue, getSellQuoteForETH } = useSqueethPool()

  const {
    tradeAmount: amountInputValue,
    setTradeAmount: setAmount,
    quote,
    inputQuoteLoading,
    setInputQuoteLoading,
    setInputType,
    altTradeAmount: altAmountInputValue,
    setAltTradeAmount,
    setTradeSuccess,
    slippageAmount,
    confirmedAmount,
    setConfirmedAmount,
  } = useTrade()
  const { ethPrice } = useWorldContext()
  const amount = new BigNumber(amountInputValue)
  const altTradeAmount = new BigNumber(altAmountInputValue)
  const { allowance: squeethAllowance, approve: squeethApprove } = useUserAllowance(oSqueeth, swapRouter)
  const { selectWallet, connected } = useWallet()
  const { longSqthBal, shortDebt } = usePositions()

  const isShort = shortDebt.gt(0)

  useEffect(() => {
    //if it's insufficient amount them set it to it's maximum
    if (!open && longSqthBal.lt(amount)) {
      setAmount(longSqthBal.toString())
      getSellQuoteForETH(longSqthBal).then((val) => {
        setAltTradeAmount(val.amountIn.toString())
        setConfirmedAmount(val.amountIn.toFixed(6).toString())
      })
    }
  }, [longSqthBal.toString(), open])

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
        const confirmedHash = await sell(amount)
        setConfirmed(true)
        setTxHash(confirmedHash.transactionHash)
        setTradeSuccess(true)
        setTradeCompleted(true)
      }
    } catch (e) {
      console.log(e)
    }

    setSellLoading(false)
  }, [amount.toString(), squeethAllowance.toString(), longSqthBal.toString(), sell, squeethApprove])

  const handleCloseDualInputUpdate = (v: string, currentInput: string) => {
    //If I'm inputting an amount of ETH position I'd like to sell to get squeeth, use getSellQuoteForETH in trade context
    //set eth amt and input type here,
    //set quote, loading state and squth amount in trade context
    if (currentInput === InputType.ETH) {
      if (v === altAmountInputValue) return
      setInputType(InputType.ETH)
      setAltTradeAmount(v)
    } else {
      //If I'm inputting an amount of squeeth position I'd like to sell to get ETH, use getSellQuote in trade context
      //set squth amt and input type here,
      //set quote, loading state and eth amount in trade context
      if (v === amountInputValue) return
      setInputType(InputType.SQTH)
      setAmount(v)
    }
    setInputQuoteLoading(true)
  }

  return (
    <div>
      {!confirmed ? (
        <div>
          <div className={classes.settingsContainer}>
            <Typography variant="caption" className={classes.explainer} component="div">
              {closeTitle}
            </Typography>
            <span className={classes.settingsButton}>
              <TradeSettings />
            </span>
          </div>

          <div className={classes.thirdHeading} />
          <PrimaryInput
            value={amountInputValue}
            onChange={(v) => handleCloseDualInputUpdate(v, InputType.SQTH)}
            label="Amount"
            tooltip="Amount of oSqueeth you want to close"
            actionTxt="Max"
            onActionClicked={() => handleCloseDualInputUpdate(longSqthBal.toString(), InputType.SQTH)}
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
            value={altAmountInputValue}
            onChange={(v) => handleCloseDualInputUpdate(v, InputType.ETH)}
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
              onClick={() => setConfirmed(false)}
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
  balance: number
  open: boolean
  closeTitle: string
  isLPage?: boolean
  activeStep?: number
  setTradeCompleted?: any
}

const Long: React.FC<BuyProps> = ({
  balance,
  open,
  closeTitle,
  setTradeCompleted,
  isLPage = false,
  activeStep = 0,
}) => {
  return open ? (
    <OpenLong
      balance={balance}
      open={open}
      closeTitle={closeTitle}
      isLPage={isLPage}
      activeStep={activeStep}
      setTradeCompleted={setTradeCompleted}
    />
  ) : (
    <CloseLong
      balance={balance}
      open={open}
      closeTitle={closeTitle}
      isLPage={isLPage}
      activeStep={activeStep}
      setTradeCompleted={setTradeCompleted}
    />
  )
}

export default Long

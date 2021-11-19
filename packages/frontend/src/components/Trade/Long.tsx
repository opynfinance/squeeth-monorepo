import { CircularProgress, createStyles, Divider, makeStyles, Tooltip, Typography } from '@material-ui/core'
import ArrowRightAltIcon from '@material-ui/icons/ArrowRightAlt'
import BigNumber from 'bignumber.js'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { WSQUEETH_DECIMALS } from '../../constants'
import { UNI_POOL_FEES } from '../../constants'
import { useTrade } from '../../context/trade'
import { useWallet } from '../../context/wallet'
import { useUserAllowance } from '../../hooks/contracts/useAllowance'
import { useSqueethPool } from '../../hooks/contracts/useSqueethPool'
import { useTokenBalance } from '../../hooks/contracts/useTokenBalance'
import { useAddresses } from '../../hooks/useAddress'
import { useETHPrice } from '../../hooks/useETHPrice'
import { useLongPositions, useShortPositions } from '../../hooks/usePositions'
import { PrimaryButton } from '../Buttons'
import { PrimaryInput } from '../Inputs'
import { StepperBox as Stepper } from '../StepperBox'
import Confirmed from './Confirmed'
import TradeDetails from './TradeDetails'
import TradeInfoItem from './TradeInfoItem'
import UniswapData from './UniswapData'

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
    caption: {
      marginTop: theme.spacing(1),
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
  }),
)

type BuyProps = {
  balance: number
  open: boolean
  closeTitle: string
  isLPage?: boolean
  activeStep?: number
}

const Buy: React.FC<BuyProps> = ({ balance, open, closeTitle, isLPage = false, activeStep = 0 }) => {
  const [buyLoading, setBuyLoading] = useState(false)
  const [sellLoading, setSellLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [txHash, setTxHash] = useState('')

  const classes = useStyles()
  const { swapRouter, wSqueeth } = useAddresses()
  const wSqueethBal = useTokenBalance(wSqueeth, 5, WSQUEETH_DECIMALS)
  const { sell, buyForWETH, getWSqueethPositionValue, getBuyQuoteForETH, getBuyQuote } = useSqueethPool()
  const {
    tradeAmount: amount,
    setTradeAmount: setAmount,
    squeethExposure,
    quote,
    altTradeAmount,
    setAltTradeAmount,
    setTradeSuccess,
  } = useTrade()
  const { allowance: squeethAllowance, approve: squeethApprove } = useUserAllowance(wSqueeth, swapRouter)
  const { selectWallet, connected } = useWallet()
  const ethPrice = useETHPrice()
  const { squeethAmount: shrtAmt } = useShortPositions()
  const { squeethAmount: lngAmt } = useLongPositions()

  useEffect(() => {
    if (!open && wSqueethBal.lt(amount)) {
      setAmount(wSqueethBal)
    }
  }, [wSqueethBal.toNumber(), open])

  const { openError, closeError, existingShortError } = useMemo(() => {
    let openError = null
    let closeError = null
    let existingShortError = null

    if (connected && (wSqueethBal.lt(amount) || wSqueethBal.isZero())) {
      closeError = 'Insufficient oSQTH balance'
    }
    if (connected && amount.gt(balance)) {
      openError = 'Insufficient ETH balance'
    }
    if (connected && shrtAmt.gt(0)) {
      existingShortError = 'Close your short position to open a long'
    }

    return { openError, closeError, existingShortError }
  }, [amount, balance, wSqueethBal.toNumber(), connected, shrtAmt.toNumber()])

  const transact = async () => {
    setBuyLoading(true)
    try {
      const confirmedHash = await buyForWETH(amount)
      setConfirmed(true)
      setTxHash(confirmedHash.transactionHash)
      setTradeSuccess(true)
    } catch (e) {
      console.log(e)
    }
    setBuyLoading(false)
  }

  const sellAndClose = useCallback(async () => {
    setSellLoading(true)
    try {
      if (squeethAllowance.lt(amount)) {
        await squeethApprove()
      } else {
        const confirmedHash = await sell(amount)
        setConfirmed(true)
        setTxHash(confirmedHash.transactionHash)
        setTradeSuccess(true)
      }
    } catch (e) {
      console.log(e)
    }
    setSellLoading(false)
  }, [amount, sell, squeethAllowance, squeethApprove, wSqueethBal])

  const handleCloseDualInputUpdate = (v: number | string, currentInput: string) => {
    if (currentInput === 'ETH') {
      setAltTradeAmount(new BigNumber(v))
      getBuyQuoteForETH(new BigNumber(v)).then((val) => {
        setAmount(val.amountOut)
      })
    } else {
      setAmount(new BigNumber(v))
      getBuyQuote(new BigNumber(v)).then((val) => {
        setAltTradeAmount(val.amountIn)
      })
    }
  }
  const handleOpenDualInputUpdate = (v: number | string, currentInput: string) => {
    if (currentInput === 'ETH') {
      setAmount(new BigNumber(v))
      getBuyQuoteForETH(new BigNumber(v)).then((val) => {
        setAltTradeAmount(val.amountOut)
      })
    } else {
      setAltTradeAmount(new BigNumber(v))
      getBuyQuote(new BigNumber(v)).then((val) => {
        setAmount(val.amountIn)
      })
    }
  }

  const ClosePosition = useMemo(() => {
    return (
      <div>
        {!confirmed ? (
          <div>
            <Typography variant="caption" className={classes.thirdHeading} component="div">
              {closeTitle}
            </Typography>
            <div className={classes.thirdHeading} />
            <PrimaryInput
              value={amount.toNumber()}
              onChange={(v) => handleCloseDualInputUpdate(v, 'oSQTH')}
              label="Amount"
              tooltip="Amount of wSqueeth you want to close"
              actionTxt="Max"
              onActionClicked={() => {
                setAmount(wSqueethBal)
                getBuyQuote(new BigNumber(wSqueethBal)).then((val) => {
                  setAltTradeAmount(val.amountIn)
                })
              }}
              unit="oSQTH"
              convertedValue={getWSqueethPositionValue(amount).toFixed(2).toLocaleString()}
              error={connected && shrtAmt.gt(0) ? !!existingShortError : !!closeError}
              hint={
                connected && shrtAmt.gt(0) ? (
                  existingShortError
                ) : closeError ? (
                  closeError
                ) : (
                  <div className={classes.hint}>
                    <span className={classes.hintTextContainer}>
                      <span className={classes.hintTitleText}>Position</span> <span>{wSqueethBal.toFixed(6)}</span>
                    </span>
                    {quote.amountOut.gt(0) ? (
                      <>
                        <ArrowRightAltIcon className={classes.arrowIcon} />
                        <span>{wSqueethBal.minus(amount).toFixed(6)}</span>
                      </>
                    ) : null}{' '}
                    <span style={{ marginLeft: '4px' }}>oSQTH</span>
                  </div>
                )
              }
            />
            <PrimaryInput
              value={altTradeAmount.toNumber()}
              onChange={(v) => handleCloseDualInputUpdate(v, 'ETH')}
              label="Amount"
              tooltip="Amount of wSqueeth you want to close in eth"
              unit="ETH"
              convertedValue={altTradeAmount.times(ethPrice).toFixed(2).toLocaleString()}
              error={connected && shrtAmt.gt(0) ? !!existingShortError : !!closeError}
              hint={
                connected && shrtAmt.gt(0) ? (
                  existingShortError
                ) : closeError ? (
                  closeError
                ) : (
                  <div className={classes.hint}>
                    <span>{`Balance ${balance}`}</span>
                    {amount.toNumber() ? (
                      <>
                        <ArrowRightAltIcon className={classes.arrowIcon} />
                        <span>{(balance + altTradeAmount.toNumber()).toFixed(6)}</span>
                      </>
                    ) : null}{' '}
                    <span style={{ marginLeft: '4px' }}>ETH</span>
                  </div>
                )
              }
            />
            <div className={classes.divider}>
              <UniswapData
                slippage="0.5"
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
                  variant="contained"
                  onClick={sellAndClose}
                  className={classes.amountInput}
                  disabled={!!sellLoading || !!closeError || shrtAmt.gt(0) || wSqueethBal.isZero()}
                  style={{ width: '300px' }}
                >
                  {sellLoading ? (
                    <CircularProgress color="primary" size="1.5rem" />
                  ) : squeethAllowance.lt(amount) ? (
                    'Approve oSQTH'
                  ) : (
                    'Sell to close'
                  )}
                </PrimaryButton>
              )}
              <Typography variant="caption" className={classes.caption} component="div">
                Trades on Uniswap 🦄
              </Typography>
            </div>
          </div>
        ) : (
          <div>
            <Confirmed confirmationMessage={`Sold ${amount} Squeeth`} txnHash={txHash} />
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
  }, [
    classes.thirdHeading,
    classes.squeethExp,
    classes.squeethExpTxt,
    classes.amountInput,
    classes.caption,
    closeTitle,
    amount,
    getWSqueethPositionValue,
    closeError,
    wSqueethBal,
    quote.amountOut,
    quote.priceImpact,
    quote.minimumAmountOut,
    ethPrice,
    connected,
    selectWallet,
    sellLoading,
    sellAndClose,
    squeethAllowance,
    setAmount,
  ])

  if (!open) {
    return ClosePosition
  }

  return (
    <div>
      {!confirmed ? (
        <div>
          {isLPage && <Stepper activeStep={activeStep} steps={['Buy Squeeth', 'LP the SQTH-ETH Uniswap Pool']} />}
          {activeStep === 0 ? (
            <>
              <Typography variant="caption" className={classes.thirdHeading} component="div">
                Pay ETH to buy squeeth ERC20
              </Typography>
              <div className={classes.thirdHeading} />
              <PrimaryInput
                value={amount.toNumber()}
                onChange={(v) => handleOpenDualInputUpdate(v, 'ETH')}
                label="Amount"
                tooltip="Amount of ETH you want to spend to get Squeeth exposure"
                actionTxt="Max"
                onActionClicked={() => {
                  setAmount(new BigNumber(balance))
                  getBuyQuoteForETH(new BigNumber(balance)).then((val) => {
                    setAltTradeAmount(val.amountOut)
                  })
                }}
                unit="ETH"
                convertedValue={amount.times(ethPrice).toFixed(2).toLocaleString()}
                error={connected && shrtAmt.gt(0) ? !!existingShortError : !!openError}
                hint={
                  openError ? (
                    openError
                  ) : connected && shrtAmt.gt(0) ? (
                    existingShortError
                  ) : (
                    <div className={classes.hint}>
                      <span>{`Balance ${balance}`}</span>
                      {amount.toNumber() ? (
                        <>
                          <ArrowRightAltIcon className={classes.arrowIcon} />
                          <span>{(balance - amount.toNumber()).toFixed(6)}</span>
                        </>
                      ) : null}{' '}
                      <span style={{ marginLeft: '4px' }}>ETH</span>
                    </div>
                  )
                }
              />

              <PrimaryInput
                value={altTradeAmount.toNumber()}
                onChange={(v) => handleOpenDualInputUpdate(v, 'oSQTH')}
                label="Amount"
                tooltip="Amount of Squeeth exposure"
                actionTxt="Max"
                unit="oSQTH"
                convertedValue={getWSqueethPositionValue(altTradeAmount).toFixed(2).toLocaleString()}
                error={connected && shrtAmt.gt(0) ? !!existingShortError : !!openError}
                hint={
                  openError ? (
                    openError
                  ) : connected && shrtAmt.gt(0) ? (
                    existingShortError
                  ) : (
                    <div className={classes.hint}>
                      <span className={classes.hintTextContainer}>
                        <span className={classes.hintTitleText}>Balance </span>
                        <span>{wSqueethBal.toFixed(6)}</span>
                      </span>
                      {quote.amountOut.gt(0) ? (
                        <>
                          <ArrowRightAltIcon className={classes.arrowIcon} />
                          <span>{wSqueethBal.plus(quote.amountOut).toFixed(6)}</span>
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
                    slippage="0.5"
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
                    variant="contained"
                    onClick={transact}
                    className={classes.amountInput}
                    disabled={!!buyLoading || !!openError || shrtAmt.gt(0)}
                    style={{ width: '300px' }}
                  >
                    {buyLoading ? <CircularProgress color="primary" size="1.5rem" /> : 'Buy'}
                  </PrimaryButton>
                )}
                <Typography variant="caption" className={classes.caption} component="div">
                  Trades on Uniswap V3 🦄
                </Typography>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', margin: '20px 0' }}>
              <Tooltip
                title={
                  'When you click the Uniswap link, the Uniswap LP page may take a few moments to load. Please wait for it to fully load so it can prefill LP token data.'
                }
              >
                <a
                  href={`https://squeeth-uniswap.netlify.app/#/add/ETH/${wSqueeth}/3000`}
                  target="_blank"
                  rel="noreferrer"
                  className={`${classes.anchor} ${classes.linkHover}`}
                >
                  Provide Liquidity on Uniswap V3 🦄
                </a>
              </Tooltip>
            </div>
          )}
        </div>
      ) : (
        <div>
          <Confirmed confirmationMessage={`Bought ${quote.amountOut.toFixed(6)} Squeeth`} txnHash={txHash} />
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

export default Buy

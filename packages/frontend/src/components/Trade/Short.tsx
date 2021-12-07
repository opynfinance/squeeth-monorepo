import { CircularProgress } from '@material-ui/core'
import { createStyles, Divider, InputAdornment, makeStyles, TextField, Tooltip, Typography } from '@material-ui/core'
import ArrowRightAltIcon from '@material-ui/icons/ArrowRightAlt'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'
import BigNumber from 'bignumber.js'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import { useTrade } from '../../context/trade'
import { useWallet } from '../../context/wallet'
import { useWorldContext } from '../../context/world'
import { useController } from '../../hooks/contracts/useController'
import useShortHelper from '../../hooks/contracts/useShortHelper'
import { useSqueethPool } from '../../hooks/contracts/useSqueethPool'
import { useAddresses } from '../../hooks/useAddress'
import { useETHPrice } from '../../hooks/useETHPrice'
import { useLongPositions, useShortPositions } from '../../hooks/usePositions'
import { PrimaryButton } from '../Buttons'
import CollatRange from '../CollatRange'
import { PrimaryInput } from '../inputs/PrimaryInput'
import { TradeSettings } from '../TradeSettings'
import Confirmed from './Confirmed'
import TradeDetails from './TradeDetails'
import TradeInfoItem from './TradeInfoItem'
import UniswapData from './UniswapData'

const useStyles = makeStyles((theme) =>
  createStyles({
    cardTitle: {
      color: theme.palette.primary.main,
      marginTop: theme.spacing(4),
    },
    cardHeader: {
      color: theme.palette.primary.main,
      marginTop: theme.spacing(2),
    },
    cardSubTxt: {
      color: theme.palette.text.secondary,
      lineHeight: '1.75rem',
      fontSize: '16px',
    },
    innerCard: {
      paddingBottom: theme.spacing(0),
    },
    amountInput: {
      marginTop: theme.spacing(1),
      backgroundColor: `${theme.palette.error.main}aa`,
    },
    thirdHeading: {
      marginTop: theme.spacing(2),
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
    },
    txItem: {
      display: 'flex',
      padding: theme.spacing(0, 1),
      marginTop: theme.spacing(1),
      justifyContent: 'center',
      alignItems: 'center',
    },
    txLabel: {
      fontSize: '14px',
      color: theme.palette.text.secondary,
    },
    txUnit: {
      fontSize: '12px',
      color: theme.palette.text.secondary,
      marginLeft: theme.spacing(1),
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
    divider: {
      margin: theme.spacing(2, 0),
      width: '300px',
      marginLeft: 'auto',
      marginRight: 'auto',
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
    settingsContainer: {
      display: 'flex',
      justify: 'space-between',
    },
    settingsButton: {
      marginTop: theme.spacing(2),
      marginLeft: theme.spacing(10),
      justifyContent: 'right',
    },
  }),
)

type SellType = {
  balance: number
  open: boolean
  closeTitle: string
}

const Sell: React.FC<SellType> = ({ balance, open, closeTitle }) => {
  const [collateral, setCollateral] = useState(new BigNumber(0))
  const [collatPercent, setCollatPercent] = useState(200)
  const [existingCollat, setExistingCollat] = useState(0)
  const [vaultId, setVaultId] = useState(0)
  const [isVaultApproved, setIsVaultApproved] = useState(true)
  const [shortLoading, setShortLoading] = useState(false)
  const [buyLoading, setBuyLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [withdrawCollat, setWithdrawCollat] = useState(new BigNumber(0))
  const [neededCollat, setNeededCollat] = useState(new BigNumber(0))

  const classes = useStyles()
  const { openShort, closeShort } = useShortHelper()
  const { getWSqueethPositionValue, getBuyQuoteForETH, getBuyQuote } = useSqueethPool()
  const { updateOperator, normFactor: normalizationFactor, getShortAmountFromDebt, getDebtAmount } = useController()
  const { shortHelper } = useAddresses()
  const ethPrice = useETHPrice()
  const { selectWallet, connected } = useWallet()

  const {
    tradeAmount: amount,
    setTradeAmount: setAmount,
    quote,
    sellCloseQuote,
    altTradeAmount,
    setAltTradeAmount,
    setTradeSuccess,
    slippageAmount,
  } = useTrade()
  const { squeethAmount: lngAmt } = useLongPositions()
  const { shortVaults, firstValidVault, existingCollatPercent } = useShortPositions()

  const liqPrice = useMemo(() => {
    const rSqueeth = normalizationFactor.multipliedBy(amount || 1).dividedBy(10000)
    const liqp = collateral.dividedBy(rSqueeth.multipliedBy(1.5)).toNumber()
    if (liqp) return liqp
    return 0
  }, [amount, collatPercent, collateral, normalizationFactor.toNumber()])

  useEffect(() => {
    if (!open && shortVaults.length && shortVaults[firstValidVault].shortAmount.lt(amount)) {
      setAmount(shortVaults[firstValidVault].shortAmount)
    }
  }, [shortVaults, open])

  useEffect(() => {
    if (!shortVaults.length) {
      setVaultId(0)
      return
    }

    setVaultId(shortVaults[firstValidVault].id)
  }, [shortVaults.length])

  useEffect(() => {
    if (!open) return
    const debt = collateral.times(100).dividedBy(new BigNumber(collatPercent))
    getShortAmountFromDebt(debt).then((s) => setAmount(s))
  }, [collatPercent, collateral, normalizationFactor.toNumber()])

  useEffect(() => {
    if (!vaultId) return

    setIsVaultApproved(shortVaults[firstValidVault].operator.toLowerCase() === shortHelper.toLowerCase())
  }, [vaultId])

  const depositAndShort = async () => {
    setShortLoading(true)
    try {
      if (vaultId && !isVaultApproved) {
        await updateOperator(vaultId, shortHelper)
        setIsVaultApproved(true)
      } else {
        const confirmedHash = await openShort(vaultId, new BigNumber(amount), collateral)
        setConfirmed(true)
        setTxHash(confirmedHash.transactionHash)
        setTradeSuccess(true)
      }
    } catch (e) {
      console.log(e)
    }
    setShortLoading(false)
  }

  useEffect(() => {
    if (shortVaults.length) {
      const _collat: BigNumber = shortVaults[firstValidVault].collateralAmount
      setExistingCollat(_collat.toNumber())
      const restOfShort = new BigNumber(shortVaults[firstValidVault].shortAmount).minus(amount)

      getDebtAmount(new BigNumber(restOfShort)).then((debt) => {
        const _neededCollat = debt.times(collatPercent / 100)
        setNeededCollat(_neededCollat)
        setWithdrawCollat(_collat.minus(neededCollat))
      })
    }
  }, [amount, collatPercent, shortVaults])

  const buyBackAndClose = useCallback(async () => {
    setBuyLoading(true)
    try {
      if (vaultId && !isVaultApproved) {
        await updateOperator(vaultId, shortHelper)
        setIsVaultApproved(true)
      } else {
        const _collat: BigNumber = shortVaults[firstValidVault].collateralAmount
        const restOfShort = new BigNumber(shortVaults[firstValidVault].shortAmount).minus(amount)
        const _debt: BigNumber = await getDebtAmount(new BigNumber(restOfShort))
        const neededCollat = _debt.times(collatPercent / 100)
        const confirmedHash = await closeShort(vaultId, new BigNumber(amount), _collat.minus(neededCollat))
        setConfirmed(true)
        setTxHash(confirmedHash.transactionHash)
        setTradeSuccess(true)
      }
    } catch (e) {
      console.log(e)
    }
    setBuyLoading(false)
  }, [
    amount,
    closeShort,
    collatPercent,
    getDebtAmount,
    isVaultApproved,
    shortHelper,
    shortVaults,
    updateOperator,
    vaultId,
  ])

  const { setCollatRatio } = useWorldContext()

  const { openError, closeError, existingLongError, priceImpactWarning } = useMemo(() => {
    let openError = null
    let closeError = null
    let existingLongError = null
    let priceImpactWarning = null

    if (
      connected &&
      shortVaults.length &&
      (shortVaults[firstValidVault].shortAmount.lt(amount) || shortVaults[firstValidVault].shortAmount.isZero())
    ) {
      closeError = 'Close amount exceeds position'
    }
    if (connected && new BigNumber(quote.priceImpact).gt(3)) {
      priceImpactWarning = 'High Price Impact'
    }
    if (connected && collateral.toNumber() > balance) {
      openError = 'Insufficient ETH balance'
    } else if (connected && amount.isGreaterThan(0) && collateral.plus(existingCollat).lt(0.5)) {
      openError = 'Minimum collateral is 0.5 ETH'
    }
    if (
      connected &&
      !open &&
      amount.isGreaterThan(0) &&
      shortVaults.length &&
      amount.lt(shortVaults[firstValidVault].shortAmount) &&
      neededCollat.isLessThan(0.5)
    ) {
      closeError =
        'You must have at least 0.5 ETH collateral unless you fully close out your position. Either fully close your position, or close out less'
    }
    if (connected && lngAmt.gt(0)) {
      existingLongError = 'Close your long position to open a short'
    }

    return { openError, closeError, existingLongError, priceImpactWarning }
  }, [
    amount,
    balance,
    shortVaults,
    amount,
    lngAmt.toNumber(),
    connected,
    withdrawCollat.toNumber(),
    existingCollat,
    quote.priceImpact,
  ])

  const shortClosePriceImpactErrorState = useMemo(() => {
    return (
      priceImpactWarning &&
      !buyLoading &&
      !(collatPercent < 150) &&
      !closeError &&
      !lngAmt.gt(0) &&
      shortVaults.length &&
      !shortVaults[firstValidVault].shortAmount.isZero()
    )
  }, [priceImpactWarning, buyLoading, collatPercent, closeError, lngAmt.toNumber(), shortVaults, firstValidVault])

  const shortOpenPriceImpactErrorState = useMemo(() => {
    return priceImpactWarning && !shortLoading && !(collatPercent < 150) && !openError && !lngAmt.gt(0)
  }, [priceImpactWarning, shortLoading, collatPercent, openError, lngAmt.toNumber()])

  useEffect(() => {
    setCollatRatio(collatPercent / 100)
  }, [collatPercent])

  // const handleCloseDualInputUpdate = (v: number | string, currentInput: string) => {
  //   if (isNaN(+v) || +v === 0) v = 0
  //   if (currentInput === 'ETH') {
  //     setAltTradeAmount(new BigNumber(v))
  //     getBuyQuoteForETH(new BigNumber(v)).then((val) => {
  //       setAmount(val.amountOut)
  //     })
  //   } else {
  //     setAmount(new BigNumber(v))
  //     getBuyQuote(new BigNumber(v)).then((val) => {
  //       setAltTradeAmount(val.amountIn)
  //     })
  //   }
  // }

  const ClosePosition = useMemo(() => {
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
            <div className={classes.thirdHeading}>
              <PrimaryInput
                value={amount.toNumber()}
                onChange={(v) => setAmount(new BigNumber(v))}
                label="Amount"
                tooltip="Amount of oSQTH to buy"
                actionTxt="Max"
                onActionClicked={() => setAmount(shortVaults[firstValidVault].shortAmount)}
                unit="oSQTH"
                error={
                  connected && lngAmt.gt(0)
                    ? !!existingLongError
                    : new BigNumber(quote.priceImpact).gt(3)
                    ? !!priceImpactWarning
                    : !!closeError
                }
                convertedValue={getWSqueethPositionValue(amount).toFixed(2).toLocaleString()}
                hint={
                  shortVaults.length && shortVaults[firstValidVault].shortAmount.lt(amount) ? (
                    'Close amount exceeds position'
                  ) : connected && lngAmt.gt(0) ? (
                    existingLongError
                  ) : priceImpactWarning ? (
                    priceImpactWarning
                  ) : (
                    <div className={classes.hint}>
                      <span className={classes.hintTextContainer}>
                        <span className={classes.hintTitleText}>Position</span>{' '}
                        <span>{shortVaults.length && shortVaults[firstValidVault].shortAmount.toFixed(6)}</span>
                      </span>
                      {amount.toNumber() ? (
                        <>
                          <ArrowRightAltIcon className={classes.arrowIcon} />
                          <span>
                            {shortVaults.length && shortVaults[firstValidVault].shortAmount.minus(amount).toFixed(6)}
                          </span>
                        </>
                      ) : null}{' '}
                      <span style={{ marginLeft: '4px' }}>oSQTH</span>
                    </div>
                  )
                }
              />
            </div>
            <div className={classes.thirdHeading}>
              <TextField
                size="small"
                value={collatPercent}
                type="number"
                style={{ width: 300 }}
                onChange={(event) => setCollatPercent(Number(event.target.value))}
                id="filled-basic"
                label="Collateral Ratio"
                variant="outlined"
                error={collatPercent < 150}
                helperText="Minimum is 150%"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <Typography variant="caption">%</Typography>
                    </InputAdornment>
                  ),
                }}
                inputProps={{
                  min: '0',
                }}
              />
            </div>
            <div className={classes.thirdHeading}></div>
            <CollatRange onCollatValueChange={(val) => setCollatPercent(val)} collatValue={collatPercent} />
            <TradeDetails
              actionTitle="Spend"
              amount={sellCloseQuote.amountIn.toFixed(6)}
              unit="ETH"
              value={Number(ethPrice.times(sellCloseQuote.amountIn).toFixed(2)).toLocaleString()}
              hint={
                connected && shortVaults.length && shortVaults[firstValidVault].shortAmount.gt(0) ? (
                  existingLongError
                ) : priceImpactWarning ? (
                  priceImpactWarning
                ) : (
                  <div className={classes.hint}>
                    <span>{`Balance ${balance}`}</span>
                    {amount.toNumber() ? (
                      <>
                        <ArrowRightAltIcon className={classes.arrowIcon} />
                        <span>{(balance - sellCloseQuote.amountIn.toNumber()).toFixed(6)}</span>
                      </>
                    ) : connected && lngAmt.gt(0) ? (
                      existingLongError
                    ) : null}{' '}
                    <span style={{ marginLeft: '4px' }}>ETH</span>
                  </div>
                )
              }
            />
            <div className={classes.divider}>
              <TradeInfoItem
                label="Collateral you redeem"
                value={withdrawCollat.isPositive() ? withdrawCollat.toFixed(4) : 0}
                unit="ETH"
              />
              <TradeInfoItem
                label="Current Collateral ratio"
                value={existingCollatPercent}
                unit="%"
                tooltip={'Collateral ratio for current short position'}
              />
              <div style={{ marginTop: '10px' }}>
                <UniswapData
                  slippage={isNaN(Number(slippageAmount)) ? '0' : slippageAmount.toString()}
                  priceImpact={sellCloseQuote.priceImpact}
                  minReceived={sellCloseQuote.maximumAmountIn.toFixed(4)}
                  minReceivedUnit="ETH"
                  isMaxSent={true}
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
                  onClick={buyBackAndClose}
                  className={classes.amountInput}
                  disabled={
                    buyLoading ||
                    collatPercent < 150 ||
                    !!closeError ||
                    lngAmt.gt(0) ||
                    (shortVaults.length && shortVaults[firstValidVault].shortAmount.isZero())
                  }
                  variant={shortClosePriceImpactErrorState ? 'outlined' : 'contained'}
                  style={
                    shortClosePriceImpactErrorState
                      ? { width: '300px', color: '#f5475c', backgroundColor: 'transparent', borderColor: '#f5475c' }
                      : { width: '300px' }
                  }
                >
                  {buyLoading ? (
                    <CircularProgress color="primary" size="1.5rem" />
                  ) : (
                    <>
                      {isVaultApproved
                        ? 'Buy back and close'
                        : shortClosePriceImpactErrorState && isVaultApproved
                        ? 'Buy back and close anyway'
                        : 'Add operator (1/2)'}
                      {!isVaultApproved ? (
                        <Tooltip
                          style={{ marginLeft: '2px' }}
                          title="Operator is a contract that mints squeeth, deposits collateral and sells squeeth in single TX. Similarly it also buys back + burns squeeth and withdraws collateral in single TX"
                        >
                          <InfoOutlinedIcon fontSize="small" />
                        </Tooltip>
                      ) : null}
                    </>
                  )}
                </PrimaryButton>
              )}
              <Typography variant="caption" className={classes.caption} component="div">
                Trades on Uniswap V3 🦄
              </Typography>
            </div>
          </div>
        ) : (
          <div>
            <Confirmed confirmationMessage={`Closed ${amount} Squeeth Short Position`} txnHash={txHash} />
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
    classes.divider,
    classes.amountInput,
    classes.caption,
    closeTitle,
    amount,
    closeError,
    getWSqueethPositionValue,
    shortVaults,
    collatPercent,
    sellCloseQuote.amountIn,
    sellCloseQuote.priceImpact,
    sellCloseQuote.maximumAmountIn,
    ethPrice,
    withdrawCollat,
    existingCollatPercent,
    connected,
    selectWallet,
    buyLoading,
    buyBackAndClose,
    isVaultApproved,
    setAmount,
    slippageAmount.toNumber(),
  ])

  if (!open) {
    return ClosePosition
  }

  return (
    <div>
      {!confirmed ? (
        <div>
          <div className={classes.settingsContainer}>
            <Typography variant="caption" className={classes.explainer} component="div">
              Mint & sell squeeth for premium
            </Typography>
            <span className={classes.settingsButton}>
              <TradeSettings />
            </span>
          </div>
          <div className={classes.thirdHeading}>
            <PrimaryInput
              value={collateral.toNumber().toString()}
              onChange={(v) => setCollateral(new BigNumber(v))}
              label="Collateral"
              tooltip="Amount of ETH collateral"
              actionTxt="Max"
              onActionClicked={() => setCollateral(new BigNumber(balance))}
              unit="ETH"
              convertedValue={collateral.times(ethPrice).toFixed(2).toLocaleString()}
              hint={
                !!openError ? (
                  openError
                ) : connected && lngAmt.gt(0) ? (
                  existingLongError
                ) : priceImpactWarning ? (
                  priceImpactWarning
                ) : (
                  <div className={classes.hint}>
                    <span>{`Balance ${balance}`}</span>
                    {collateral ? (
                      <>
                        <ArrowRightAltIcon className={classes.arrowIcon} />
                        <span>{new BigNumber(balance).minus(collateral).toFixed(6)}</span>
                      </>
                    ) : null}{' '}
                    <span style={{ marginLeft: '4px' }}>ETH</span>
                  </div>
                )
              }
              error={
                connected && lngAmt.gt(0)
                  ? !!existingLongError
                  : new BigNumber(quote.priceImpact).gt(3)
                  ? !!priceImpactWarning
                  : !!openError
              }
            />
          </div>
          <div className={classes.thirdHeading}>
            <TextField
              size="small"
              value={collatPercent}
              type="number"
              style={{ width: 300 }}
              onChange={(event) => setCollatPercent(Number(event.target.value))}
              id="filled-basic"
              label="Collateral Ratio"
              variant="outlined"
              error={collatPercent < 150}
              helperText="Minimum is 150%"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Typography variant="caption">%</Typography>
                  </InputAdornment>
                ),
              }}
              inputProps={{
                min: '0',
              }}
            />
          </div>
          <div className={classes.thirdHeading}></div>
          <CollatRange onCollatValueChange={(val) => setCollatPercent(val)} collatValue={collatPercent} />
          <TradeDetails
            actionTitle="Sell"
            amount={amount.toFixed(6)}
            unit="oSQTH"
            value={Number(getWSqueethPositionValue(amount).toFixed(2)).toLocaleString()}
            hint={
              !!openError ? (
                openError
              ) : connected && lngAmt.gt(0) ? (
                existingLongError
              ) : (
                <div className={classes.hint}>
                  <span className={classes.hintTextContainer}>
                    <span className={classes.hintTitleText}>Position</span>
                    <span>{shortVaults.length && shortVaults[firstValidVault].shortAmount.toFixed(6)}</span>
                  </span>
                  {quote.amountOut.gt(0) ? (
                    <>
                      <ArrowRightAltIcon className={classes.arrowIcon} />
                      <span>
                        {shortVaults.length && shortVaults[firstValidVault].shortAmount.plus(amount).toFixed(6)}
                      </span>
                    </>
                  ) : null}{' '}
                  <span style={{ marginLeft: '4px' }}>oSQTH</span>
                </div>
              )
            }
          />
          <div className={classes.divider}>
            <TradeInfoItem
              label="Liquidation Price"
              value={liqPrice.toFixed(2)}
              unit="USDC"
              tooltip="Price of ETH when liquidation occurs"
            />
            <TradeInfoItem
              label="Initial Premium"
              value={quote.amountOut.toFixed(4)}
              unit="ETH"
              tooltip={'Initial payment you get for selling squeeth on Uniswap'}
            />
            <TradeInfoItem
              label="Current Collateral ratio"
              value={existingCollatPercent}
              unit="%"
              tooltip={'Collateral ratio for current short position'}
            />
            <div style={{ marginTop: '10px' }}>
              <UniswapData
                slippage={isNaN(Number(slippageAmount)) ? '0' : slippageAmount.toString()}
                priceImpact={quote.priceImpact}
                minReceived={quote.minimumAmountOut.toFixed(6)}
                minReceivedUnit="ETH"
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
                onClick={depositAndShort}
                className={classes.amountInput}
                disabled={shortLoading || collatPercent < 150 || !!openError || lngAmt.gt(0)}
                variant={shortOpenPriceImpactErrorState ? 'outlined' : 'contained'}
                style={
                  shortOpenPriceImpactErrorState
                    ? { width: '300px', color: '#f5475c', backgroundColor: 'transparent', borderColor: '#f5475c' }
                    : { width: '300px' }
                }
              >
                {shortLoading ? (
                  <CircularProgress color="primary" size="1.5rem" />
                ) : (
                  <>
                    {isVaultApproved
                      ? 'Deposit and sell'
                      : shortOpenPriceImpactErrorState && isVaultApproved
                      ? 'Deposit and sell anyway'
                      : 'Add operator (1/2)'}
                    {!isVaultApproved ? (
                      <Tooltip
                        style={{ marginLeft: '2px' }}
                        title="Operator is a contract that mints squeeth, deposits collateral and sells squeeth in single TX. Similarly it also buys back + burns squeeth and withdraws collateral in single TX"
                      >
                        <InfoOutlinedIcon fontSize="small" />
                      </Tooltip>
                    ) : null}
                  </>
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
          <Confirmed confirmationMessage={`Opened ${amount.toFixed(6)} Squeeth Short Position`} txnHash={txHash} />
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

export default Sell

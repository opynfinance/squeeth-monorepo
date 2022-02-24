import { CircularProgress } from '@material-ui/core'
import {
  createStyles,
  InputAdornment,
  makeStyles,
  TextField,
  Tooltip,
  Typography,
  Select,
  MenuItem,
} from '@material-ui/core'
import ArrowRightAltIcon from '@material-ui/icons/ArrowRightAlt'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'
import BigNumber from 'bignumber.js'
import React, { useCallback, useEffect, useState } from 'react'
import { useAtom } from 'jotai'

import { CloseType, Tooltips, Links } from '@constants/enums'
import { useTrade } from '@context/trade'
// import { useWallet } from '@context/wallet'
import { useWorldContext } from '@context/world'
import { normFactorAtom, useController } from '@hooks/contracts/useController'
import useShortHelper from '@hooks/contracts/useShortHelper'
import { useSqueethPool } from '@hooks/contracts/useSqueethPool'
import { useVaultManager } from '@hooks/contracts/useVaultManager'
import { useAddresses } from '@hooks/useAddress'
import { usePositions } from '@context/positions'
import { PrimaryButton } from '@components/Button'
import CollatRange from '@components/CollatRange'
import { PrimaryInput } from '@components/Input/PrimaryInput'
import { TradeSettings } from '@components/TradeSettings'
import Confirmed, { ConfirmType } from '@components/Trade/Confirmed'
import TradeDetails from '@components/Trade/TradeDetails'
import TradeInfoItem from '@components/Trade/TradeInfoItem'
import UniswapData from '@components/Trade/UniswapData'
import { MIN_COLLATERAL_AMOUNT } from '../../../constants'
import { PositionType } from '../../../types'
import { useVaultData } from '@hooks/useVaultData'
import { connectedWalletAtom } from 'src/state/wallet/atoms'
import { useSelectWallet } from 'src/state/wallet/hooks'
import { addressesAtom } from 'src/state/positions/atoms'

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
      '&:hover': {
        backgroundColor: theme.palette.error.dark,
      },
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
      fontSize: '13px',
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
    formHelperText: {
      marginLeft: 0,
      marginRight: 0,
    },
  }),
)

const OpenShort: React.FC<SellType> = ({ balance, open, closeTitle, setTradeCompleted }) => {
  const [collateralInput, setCollateralInput] = useState('0')
  const [collatPercent, setCollatPercent] = useState(150)
  const [existingCollat, setExistingCollat] = useState(new BigNumber(0))
  const [confirmedAmount, setConfirmedAmount] = useState('')
  const [isVaultApproved, setIsVaultApproved] = useState(true)
  const [shortLoading, setShortLoading] = useState(false)
  const [buyLoading, setBuyLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [liqPrice, setLiqPrice] = useState(new BigNumber(0))
  const [txHash, setTxHash] = useState('')
  const [withdrawCollat, setWithdrawCollat] = useState(new BigNumber(0))
  const [neededCollat, setNeededCollat] = useState(new BigNumber(0))

  const classes = useStyles()
  const { openShort } = useShortHelper()
  const { getWSqueethPositionValue } = useSqueethPool()
  const { updateOperator, getShortAmountFromDebt, getDebtAmount } = useController()
  const normalizationFactor = useAtom(normFactorAtom)[0]
  // const { selectWallet, connected } = useWallet()
  const [connected] = useAtom(connectedWalletAtom)
  const selectWallet = useSelectWallet()

  // const { shortHelper } = useAddresses()
  const [{ shortHelper }] = useAtom(addressesAtom)

  const {
    tradeAmount: amountInputValue,
    setTradeAmount: setAmount,
    quote,
    tradeType,
    tradeSuccess,
    setTradeSuccess,
    slippageAmount,
  } = useTrade()
  const amount = new BigNumber(amountInputValue)
  const collateral = new BigNumber(collateralInput)
  const { firstValidVault, squeethAmount: shortSqueethAmount, isLong } = usePositions()
  const { vaults: shortVaults, loading: vaultIDLoading } = useVaultManager()

  const [vaultId, setVaultId] = useState(shortVaults.length ? shortVaults[firstValidVault].id : 0)
  useEffect(() => {
    const rSqueeth = normalizationFactor.multipliedBy(amount || 1).dividedBy(10000)
    const liqp = collateral.dividedBy(rSqueeth.multipliedBy(1.5))
    if (liqp.toString() || liqp.toString() !== '0') setLiqPrice(liqp)
  }, [amount.toString(), collatPercent, collateral.toString(), normalizationFactor.toString()])

  useEffect(() => {
    if (!open && shortVaults.length && shortVaults[firstValidVault].shortAmount.lt(amount)) {
      setAmount(shortVaults[firstValidVault].shortAmount.toString())
    }
  }, [shortVaults?.length, open])

  useEffect(() => {
    if (!shortVaults.length) {
      setVaultId(0)
      return
    }

    setVaultId(shortVaults[firstValidVault].id)
  }, [shortVaults?.length, firstValidVault])

  const { existingCollatPercent } = useVaultData(Number(vaultId))

  useEffect(() => {
    if (!open) return
    const debt = collateral.times(100).dividedBy(new BigNumber(collatPercent))
    getShortAmountFromDebt(debt).then((s) => setAmount(s.toString()))
  }, [collatPercent, collateral.toString(), normalizationFactor.toString()])

  useEffect(() => {
    if (!vaultId) return

    setIsVaultApproved(shortVaults[firstValidVault].operator?.toLowerCase() === shortHelper?.toLowerCase())
  }, [vaultId])

  const depositAndShort = async () => {
    setShortLoading(true)
    try {
      if (vaultIDLoading) return
      if (vaultId && !isVaultApproved) {
        await updateOperator(vaultId, shortHelper)
        setIsVaultApproved(true)
      } else {
        const confirmedHash = await openShort(vaultId, amount, collateral)
        setConfirmed(true)
        setConfirmedAmount(amount.toFixed(6).toString())
        setTxHash(confirmedHash.transactionHash)
        setTradeSuccess(true)
        setTradeCompleted(true)
      }
    } catch (e) {
      console.log(e)
    }
    setShortLoading(false)
  }

  useEffect(() => {
    if (shortVaults.length) {
      const _collat: BigNumber = shortVaults[firstValidVault].collateralAmount
      setExistingCollat(_collat)
      const restOfShort = new BigNumber(shortVaults[firstValidVault].shortAmount).minus(amount)

      getDebtAmount(new BigNumber(restOfShort)).then((debt) => {
        const _neededCollat = debt.times(collatPercent / 100)
        setNeededCollat(_neededCollat)
        setWithdrawCollat(_collat.minus(neededCollat))
      })
    }
  }, [amount.toString(), collatPercent, shortVaults?.length])

  const { setCollatRatio, ethPrice, oSqueethBal } = useWorldContext()

  let openError: string | undefined
  let closeError: string | undefined
  let existingLongError: string | undefined
  let priceImpactWarning: string | undefined
  let vaultIdDontLoadedError: string | undefined

  if (connected) {
    if (
      shortVaults.length &&
      (shortVaults[firstValidVault].shortAmount.lt(amount) || shortVaults[firstValidVault].shortAmount.isZero())
    ) {
      closeError = 'Close amount exceeds position'
    }
    if (new BigNumber(quote.priceImpact).gt(3)) {
      priceImpactWarning = 'High Price Impact'
    }
    if (collateral.isGreaterThan(new BigNumber(balance))) {
      openError = 'Insufficient ETH balance'
    } else if (amount.isGreaterThan(0) && collateral.plus(existingCollat).lt(MIN_COLLATERAL_AMOUNT)) {
      openError = `Minimum collateral is ${MIN_COLLATERAL_AMOUNT} ETH`
    } else if (shortVaults.length && vaultId === 0 && shortVaults[firstValidVault]?.shortAmount.gt(0)) {
      vaultIdDontLoadedError = 'Loading Vault...'
    }
    if (
      !open &&
      amount.isGreaterThan(0) &&
      shortVaults.length &&
      amount.lt(shortVaults[firstValidVault].shortAmount) &&
      neededCollat.isLessThan(MIN_COLLATERAL_AMOUNT)
    ) {
      closeError = `You must have at least ${MIN_COLLATERAL_AMOUNT} ETH collateral unless you fully close out your position. Either fully close your position, or close out less`
    }
    if (isLong) {
      existingLongError = 'Close your long position to open a short'
    }
  }

  const shortOpenPriceImpactErrorState =
    priceImpactWarning && !shortLoading && !(collatPercent < 150) && !openError && !existingLongError

  useEffect(() => {
    setCollatRatio(collatPercent / 100)
  }, [collatPercent])

  useEffect(() => {
    setCollateralInput('0')
  }, [tradeSuccess, tradeType])

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
              value={collateralInput}
              onChange={(v) => setCollateralInput(v)}
              label="Collateral"
              tooltip={Tooltips.SellOpenAmount}
              actionTxt="Max"
              onActionClicked={() => setCollateralInput(balance.toString())}
              unit="ETH"
              convertedValue={!collateral.isNaN() ? collateral.times(ethPrice).toFixed(2).toLocaleString() : 0}
              hint={
                openError ? (
                  openError
                ) : existingLongError ? (
                  existingLongError
                ) : priceImpactWarning ? (
                  priceImpactWarning
                ) : (
                  <div className={classes.hint}>
                    <span>{`Balance ${balance.toFixed(4)}`}</span>
                    {!collateral.isNaN() ? (
                      <>
                        <ArrowRightAltIcon className={classes.arrowIcon} />
                        <span>{new BigNumber(balance).minus(collateral).toFixed(4)}</span>
                      </>
                    ) : null}
                    <span style={{ marginLeft: '4px' }}>ETH</span>
                  </div>
                )
              }
              error={!!existingLongError || !!priceImpactWarning || !!openError}
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
              helperText="At risk of liquidation at 150%"
              FormHelperTextProps={{ classes: { root: classes.formHelperText } }}
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
            amount={!amount.isNaN() ? amount.toFixed(6) : Number(0).toLocaleString()}
            unit="oSQTH"
            value={
              !amount.isNaN()
                ? Number(getWSqueethPositionValue(amount).toFixed(2)).toLocaleString()
                : Number(0).toLocaleString()
            }
            hint={
              openError ? (
                openError
              ) : existingLongError ? (
                existingLongError
              ) : (
                <div className={classes.hint}>
                  <span className={classes.hintTextContainer}>
                    <span className={classes.hintTitleText}>Position</span>
                    <span>
                      {shortSqueethAmount.toFixed(4)}
                      {/* {shortVaults.length && shortVaults[firstValidVault].shortAmount.toFixed(6)} */}
                    </span>
                  </span>
                  {quote.amountOut.gt(0) ? (
                    <>
                      <ArrowRightAltIcon className={classes.arrowIcon} />
                      <span>{shortSqueethAmount.plus(amount).toFixed(4)}</span>
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
              tooltip={`${Tooltips.LiquidationPrice}. ${Tooltips.Twap}`}
              priceType="twap"
            />
            <TradeInfoItem
              label="Initial Premium"
              value={quote.amountOut.toFixed(4)}
              unit="ETH"
              tooltip={Tooltips.InitialPremium}
            />
            <TradeInfoItem
              label="Current Collateral ratio"
              value={existingCollatPercent}
              unit="%"
              tooltip={Tooltips.CurrentCollRatio}
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
                disabled={
                  collateralInput === '0' ||
                  shortLoading ||
                  collatPercent < 150 ||
                  !!openError ||
                  !!existingLongError ||
                  (shortVaults.length && shortVaults[firstValidVault].shortAmount.isZero()) ||
                  !!vaultIdDontLoadedError
                }
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
                      : 'Allow wrapper to manage vault (1/2)'}
                    {!isVaultApproved ? (
                      <Tooltip style={{ marginLeft: '2px' }} title={Tooltips.Operator}>
                        <InfoOutlinedIcon fontSize="small" />
                      </Tooltip>
                    ) : null}
                  </>
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
            confirmationMessage={`Opened ${confirmedAmount} Squeeth Short Position`}
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

const CloseShort: React.FC<SellType> = ({ balance, open, closeTitle, setTradeCompleted }) => {
  const [collateral, setCollateral] = useState(new BigNumber(0))
  const [confirmedAmount, setConfirmedAmount] = useState('')
  const [collatPercent, setCollatPercent] = useState(200)
  const [existingCollat, setExistingCollat] = useState(new BigNumber(0))
  const [vaultId, setVaultId] = useState(0)
  const [isVaultApproved, setIsVaultApproved] = useState(true)
  const [finalShortAmount, setFinalShortAmount] = useState(new BigNumber(0))
  const [buyLoading, setBuyLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [txHash, setTxHash] = useState('')
  const [withdrawCollat, setWithdrawCollat] = useState(new BigNumber(0))
  const [neededCollat, setNeededCollat] = useState(new BigNumber(0))
  const [closeType, setCloseType] = useState(CloseType.FULL)

  const classes = useStyles()
  const { closeShort } = useShortHelper()
  const { getWSqueethPositionValue } = useSqueethPool()
  const { updateOperator, getShortAmountFromDebt, getDebtAmount } = useController()
  const normalizationFactor = useAtom(normFactorAtom)[0]
  // const { shortHelper } = useAddresses()
  const [{ shortHelper }] = useAtom(addressesAtom)

  // const { selectWallet, connected } = useWallet()
  const [connected] = useAtom(connectedWalletAtom)
  const selectWallet = useSelectWallet()

  const {
    tradeAmount: amountInputValue,
    setTradeAmount: setAmount,
    quote,
    sellCloseQuote,
    tradeType,
    setTradeSuccess,
    slippageAmount,
  } = useTrade()
  const amount = new BigNumber(amountInputValue)
  const {
    shortVaults,
    firstValidVault,
    squeethAmount: shortSqueethAmount,
    isLong,
    lpedSqueeth,
    mintedDebt,
    shortDebt,
    loading: isPositionFinishedCalc,
  } = usePositions()
  const { setCollatRatio, ethPrice } = useWorldContext()

  useEffect(() => {
    if (!shortVaults.length) return
    // const calculatedShort = mintedDebt.plus(lpedSqueeth).plus(shortDebt)
    const contractShort = shortVaults.length && shortVaults[firstValidVault]?.shortAmount

    // if (!calculatedShort.isEqualTo(contractShort)) {
    //   setFinalShortAmount(contractShort)
    // } else {
    //   setFinalShortAmount(shortDebt)
    // }
    setFinalShortAmount(contractShort)
  }, [shortVaults?.length, firstValidVault])
  // }, [shortVaults?.length, mintedDebt.toString(), shortDebt.toString(), lpedSqueeth.toString(), firstValidVault])

  useEffect(() => {
    if (!open && shortVaults.length && shortVaults[firstValidVault].shortAmount.lt(amount)) {
      setAmount(shortVaults[firstValidVault].shortAmount.toString())
    }
  }, [shortVaults?.length, open])

  useEffect(() => {
    if (!shortVaults.length) {
      setVaultId(0)
      return
    }

    setVaultId(shortVaults[firstValidVault].id)
  }, [shortVaults?.length])

  const { existingCollatPercent } = useVaultData(Number(vaultId))

  useEffect(() => {
    if (!open) return
    const debt = collateral.times(100).dividedBy(new BigNumber(collatPercent))
    getShortAmountFromDebt(debt).then((s) => setAmount(s.toString()))
    setConfirmedAmount(amount.toFixed(6).toString())
  }, [collatPercent, collateral.toString(), normalizationFactor.toString()])

  useEffect(() => {
    if (!vaultId) return

    setIsVaultApproved(shortVaults[firstValidVault].operator?.toLowerCase() === shortHelper?.toLowerCase())
  }, [vaultId])

  useEffect(() => {
    if (shortVaults.length) {
      const _collat: BigNumber = shortVaults[firstValidVault].collateralAmount
      setExistingCollat(_collat)
      const restOfShort = new BigNumber(shortVaults[firstValidVault].shortAmount).minus(amount)

      getDebtAmount(new BigNumber(restOfShort)).then((debt) => {
        const _neededCollat = debt.times(collatPercent / 100)
        setNeededCollat(_neededCollat)
        setWithdrawCollat(_neededCollat.gt(0) ? _collat.minus(neededCollat) : _collat)
      })
    }
  }, [amount.toString(), collatPercent, shortVaults?.length])

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
        const confirmedHash = await closeShort(vaultId, amount, _collat.minus(neededCollat))
        setConfirmed(true)
        setConfirmedAmount(amount.toFixed(6).toString())
        setTxHash(confirmedHash.transactionHash)
        setTradeSuccess(true)
        setTradeCompleted(true)
      }
    } catch (e) {
      console.log(e)
    }
    setBuyLoading(false)
  }, [
    amount.toString(),
    closeShort,
    collatPercent,
    getDebtAmount,
    isVaultApproved,
    shortHelper,
    shortVaults?.length,
    updateOperator,
    vaultId,
  ])

  const setShortCloseMax = useCallback(() => {
    if (finalShortAmount.isGreaterThan(0)) {
      setAmount(finalShortAmount.toString())
      setCollatPercent(150)
      setCloseType(CloseType.FULL)
    }
  }, [finalShortAmount.toString()])

  let openError: string | undefined
  let closeError: string | undefined
  let existingLongError: string | undefined
  let priceImpactWarning: string | undefined
  let vaultIdDontLoadedError: string | undefined
  let insufficientETHBalance: string | undefined

  if (connected) {
    if (finalShortAmount.lt(0) && finalShortAmount.lt(amount)) {
      closeError = 'Close amount exceeds position'
    }
    if (new BigNumber(quote.priceImpact).gt(3)) {
      priceImpactWarning = 'High Price Impact'
    }
    if (collateral.isGreaterThan(new BigNumber(balance))) {
      openError = 'Insufficient ETH balance'
    } else if (amount.isGreaterThan(0) && collateral.plus(existingCollat).lt(MIN_COLLATERAL_AMOUNT)) {
      openError = `Minimum collateral is ${MIN_COLLATERAL_AMOUNT} ETH`
    } else if (vaultId === 0 && finalShortAmount.gt(0)) {
      vaultIdDontLoadedError = 'Loading Vault...'
    }
    if (
      !open &&
      amount.isGreaterThan(0) &&
      shortVaults.length &&
      amount.lt(finalShortAmount) &&
      neededCollat.isLessThan(MIN_COLLATERAL_AMOUNT)
    ) {
      closeError = `You must have at least ${MIN_COLLATERAL_AMOUNT} ETH collateral unless you fully close out your position. Either fully close your position, or close out less`
    }
    if (isLong && !finalShortAmount.isGreaterThan(0)) {
      existingLongError = 'Close your long position to open a short'
    }
    if (sellCloseQuote.amountIn.gt(balance)) {
      insufficientETHBalance = 'Insufficient ETH Balance'
    }
  }

  const shortClosePriceImpactErrorState =
    priceImpactWarning &&
    !buyLoading &&
    !(collatPercent < 150) &&
    !closeError &&
    !existingLongError &&
    shortVaults.length &&
    !shortVaults[firstValidVault].shortAmount.isZero()

  useEffect(() => {
    setCollatRatio(collatPercent / 100)
  }, [collatPercent])

  useEffect(() => {
    if (finalShortAmount.isGreaterThan(0)) {
      setAmount(finalShortAmount.toString())
      setCollatPercent(150)
      setCloseType(CloseType.FULL)
    }
  }, [tradeType, open, finalShortAmount.toString()])

  const handleAmountInput = (v: string) => {
    setAmount(v)
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
          <div className={classes.thirdHeading}>
            <PrimaryInput
              isFullClose={closeType === CloseType.FULL}
              value={amountInputValue}
              onChange={(v) => handleAmountInput(v)}
              label="Amount"
              tooltip={Tooltips.SellCloseAmount}
              actionTxt="Max"
              onActionClicked={setShortCloseMax}
              unit="oSQTH"
              error={!!existingLongError || !!priceImpactWarning || !!closeError || !!insufficientETHBalance}
              isLoading={isPositionFinishedCalc}
              convertedValue={
                !amount.isNaN()
                  ? getWSqueethPositionValue(amount).toFixed(2).toLocaleString()
                  : Number(0).toLocaleString()
              }
              hint={
                closeError ? (
                  closeError
                ) : existingLongError ? (
                  existingLongError
                ) : priceImpactWarning ? (
                  priceImpactWarning
                ) : insufficientETHBalance ? (
                  insufficientETHBalance
                ) : (
                  <div className={classes.hint}>
                    <span className={classes.hintTextContainer}>
                      <span className={classes.hintTitleText}>Position</span> <span>{finalShortAmount.toFixed(6)}</span>
                    </span>
                    {amount.toNumber() ? (
                      <>
                        <ArrowRightAltIcon className={classes.arrowIcon} />
                        <span>{finalShortAmount?.minus(amount).toFixed(6)}</span>
                      </>
                    ) : null}{' '}
                    <span style={{ marginLeft: '4px' }}>oSQTH</span>
                  </div>
                )
              }
            />
          </div>
          <div style={{ width: '100%', padding: '0 25px 5px 25px' }}>
            <Select
              label="Type of Close"
              value={closeType}
              onChange={(event: React.ChangeEvent<{ value: unknown }>) => {
                if (event.target.value === CloseType.FULL) {
                  setShortCloseMax()
                }
                return setCloseType(event.target.value as CloseType)
              }}
              displayEmpty
              inputProps={{ 'aria-label': 'Without label' }}
              style={{ padding: '5px 0px', width: '100%', textAlign: 'left' }}
            >
              <MenuItem value={CloseType.FULL}>Full Close</MenuItem>
              <MenuItem value={CloseType.PARTIAL}>Partial Close</MenuItem>
            </Select>
          </div>
          {closeType === CloseType.PARTIAL && (
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
                helperText="At risk of liquidation at 150%."
                FormHelperTextProps={{ classes: { root: classes.formHelperText } }}
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
              <CollatRange
                className={classes.thirdHeading}
                onCollatValueChange={(val) => setCollatPercent(val)}
                collatValue={collatPercent}
              />
            </div>
          )}
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
              ) : insufficientETHBalance ? (
                insufficientETHBalance
              ) : (
                <div className={classes.hint}>
                  <span>{`Balance ${balance}`}</span>
                  {amount.toNumber() ? (
                    <>
                      <ArrowRightAltIcon className={classes.arrowIcon} />
                      <span>{new BigNumber(balance).minus(sellCloseQuote.amountIn).toFixed(6)}</span>
                    </>
                  ) : existingLongError ? (
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
              tooltip={Tooltips.CurrentCollRatio}
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
                  amountInputValue === '0' ||
                  buyLoading ||
                  collatPercent < 150 ||
                  !!closeError ||
                  !!existingLongError ||
                  (shortVaults.length && shortVaults[firstValidVault].shortAmount.isZero()) ||
                  !!vaultIdDontLoadedError ||
                  !!insufficientETHBalance
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
                      : 'Allow wrapper to manage vault (1/2)'}
                    {!isVaultApproved ? (
                      <Tooltip style={{ marginLeft: '2px' }} title={Tooltips.Operator}>
                        <InfoOutlinedIcon fontSize="small" />
                      </Tooltip>
                    ) : null}
                  </>
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
            confirmationMessage={`Closed ${confirmedAmount} Squeeth Short Position`}
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

type SellType = {
  balance: number
  open: boolean
  closeTitle: string
  setTradeCompleted: any
}

const Short: React.FC<SellType> = ({ balance, open, closeTitle, setTradeCompleted }) => {
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

  return open ? (
    <OpenShort balance={balance} open={open} closeTitle={closeTitle} setTradeCompleted={setTradeCompleted} />
  ) : (
    <CloseShort balance={balance} open={open} closeTitle={closeTitle} setTradeCompleted={setTradeCompleted} />
  )
}

export default Short

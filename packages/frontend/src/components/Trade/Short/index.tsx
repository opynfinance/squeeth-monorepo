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
import React, { memo, useState } from 'react'

import { CloseType, Tooltips, Links } from '@constants/enums'
import useShortHelper from '@hooks/contracts/useShortHelper'
import { useVaultManager } from '@hooks/contracts/useVaultManager'
import { PrimaryButton } from '@components/Button'
import CollatRange from '@components/CollatRange'
import { PrimaryInput } from '@components/Input/PrimaryInput'
import { TradeSettings } from '@components/TradeSettings'
import Confirmed, { ConfirmType } from '@components/Trade/Confirmed'
import TradeDetails from '@components/Trade/TradeDetails'
import TradeInfoItem from '@components/Trade/TradeInfoItem'
import UniswapData from '@components/Trade/UniswapData'
import { BIG_ZERO, MIN_COLLATERAL_AMOUNT } from '../../../constants'
import { connectedWalletAtom, isTransactionFirstStepAtom, supportedNetworkAtom } from 'src/state/wallet/atoms'
import { useSelectWallet, useTransactionStatus, useWalletBalance } from 'src/state/wallet/hooks'
import { addressesAtom, isLongAtom, vaultHistoryUpdatingAtom } from 'src/state/positions/atoms'
import { useAtom, useAtomValue } from 'jotai'
import { useETHPrice } from '@hooks/useETHPrice'
import { collatRatioAtom } from 'src/state/ethPriceCharts/atoms'
import { useResetAtom, useUpdateAtom } from 'jotai/utils'
import { useGetBuyQuote, useGetSellQuote, useGetWSqueethPositionValue } from 'src/state/squeethPool/hooks'
import { useGetDebtAmount, useGetShortAmountFromDebt, useUpdateOperator } from 'src/state/controller/hooks'
import { useComputeSwaps, useFirstValidVault, useLPPositionsQuery, useVaultQuery } from 'src/state/positions/hooks'
import {
  ethTradeAmountAtom,
  quoteAtom,
  sellCloseQuoteAtom,
  slippageAmountAtom,
  sqthTradeAmountAtom,
  tradeCompletedAtom,
  tradeSuccessAtom,
  tradeTypeAtom,
} from 'src/state/trade/atoms'
import { toTokenAmount } from '@utils/calculations'
import { normFactorAtom } from 'src/state/controller/atoms'
import { TradeType } from '../../../types'
import Cancelled from '../Cancelled'
import { useVaultData } from '@hooks/useVaultData'
import useAppEffect from '@hooks/useAppEffect'
import useAppCallback from '@hooks/useAppCallback'
import { useVaultHistoryQuery } from '@hooks/useVaultHistory'
import useAppMemo from '@hooks/useAppMemo'

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
    displayBlock: {
      display: 'block',
    },
    displayNone: {
      display: 'none',
    },
  }),
)

const OpenShort: React.FC<SellType> = ({ open }) => {
  const [ethTradeAmount, setEthTradeAmount] = useAtom(ethTradeAmountAtom)
  const resetEthTradeAmount = useResetAtom(ethTradeAmountAtom)
  const [collatPercent, setCollatPercent] = useState(200)
  const [existingCollat, setExistingCollat] = useState(new BigNumber(0))
  const [confirmedAmount, setConfirmedAmount] = useState('')
  const [isVaultApproved, setIsVaultApproved] = useState(true)
  const [shortLoading, setShortLoading] = useState(false)
  const [liqPrice, setLiqPrice] = useState(new BigNumber(0))
  const [neededCollat, setNeededCollat] = useState(new BigNumber(0))

  const classes = useStyles()
  const {
    cancelled,
    confirmed,
    loading: transactionInProgress,
    transactionData,
    resetTxCancelled,
    resetTransactionData,
  } = useTransactionStatus()

  const { openShort } = useShortHelper()

  const getWSqueethPositionValue = useGetWSqueethPositionValue()
  const getSellQuote = useGetSellQuote()
  const { data } = useWalletBalance()
  const balance = Number(toTokenAmount(data ?? BIG_ZERO, 18).toFixed(4))

  const connected = useAtomValue(connectedWalletAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const selectWallet = useSelectWallet()

  const { shortHelper } = useAtomValue(addressesAtom)
  const setTradeCompleted = useUpdateAtom(tradeCompletedAtom)

  const updateOperator = useUpdateOperator()
  const getShortAmountFromDebt = useGetShortAmountFromDebt()
  const getDebtAmount = useGetDebtAmount()
  const setTradeSuccess = useUpdateAtom(tradeSuccessAtom)
  const normalizationFactor = useAtomValue(normFactorAtom)

  const [quote, setQuote] = useAtom(quoteAtom)
  const [sqthTradeAmount, setSqthTradeAmount] = useAtom(sqthTradeAmountAtom)
  const [isTxFirstStep, setIsTxFirstStep] = useAtom(isTransactionFirstStepAtom)

  const slippageAmount = useAtomValue(slippageAmountAtom)
  const tradeType = useAtomValue(tradeTypeAtom)
  const amount = useAppMemo(() => new BigNumber(sqthTradeAmount), [sqthTradeAmount])
  const collateral = useAppMemo(() => new BigNumber(ethTradeAmount), [ethTradeAmount])
  const isLong = useAtomValue(isLongAtom)
  const { firstValidVault, vaultId } = useFirstValidVault()
  const { squeethAmount: shortSqueethAmount } = useComputeSwaps()
  const [isVaultHistoryUpdating, setVaultHistoryUpdating] = useAtom(vaultHistoryUpdatingAtom)
  const { vaults: shortVaults, loading: vaultIDLoading } = useVaultManager()
  const vaultHistoryQuery = useVaultHistoryQuery(vaultId, isVaultHistoryUpdating)

  useAppEffect(() => {
    getSellQuote(amount, slippageAmount).then(setQuote)
  }, [amount, slippageAmount, getSellQuote, setQuote])

  useAppEffect(() => {
    const rSqueeth = normalizationFactor.multipliedBy(amount || 1).dividedBy(10000)
    const liqp = collateral.dividedBy(rSqueeth.multipliedBy(1.5))
    if (liqp.toString() || liqp.toString() !== '0') setLiqPrice(liqp)
  }, [amount, collatPercent, collateral, normalizationFactor])

  // useAppEffect(() => {
  //   if (!open && shortVaults.length && shortVaults[firstValidVault].shortAmount.lt(amount)) {
  //     setSqthTradeAmount(shortVaults[firstValidVault].shortAmount.toString())
  //   }
  // }, [shortVaults?.length, open])

  const { existingCollatPercent, updateVault } = useVaultData(vaultId)

  useAppEffect(() => {
    const debt = collateral.times(100).dividedBy(new BigNumber(collatPercent))
    getShortAmountFromDebt(debt).then((s) => setSqthTradeAmount(s.toString()))
  }, [collatPercent, collateral, normalizationFactor, tradeType, open, getShortAmountFromDebt, setSqthTradeAmount])

  useAppEffect(() => {
    if (!vaultId || !shortVaults?.length) return

    setIsVaultApproved(shortVaults[firstValidVault].operator?.toLowerCase() === shortHelper?.toLowerCase())
  }, [vaultId, firstValidVault, shortHelper, shortVaults])

  const depositAndShort = useAppCallback(async () => {
    setShortLoading(true)
    try {
      if (vaultIDLoading) {
        setShortLoading(false)
        return
      }
      if (vaultId && !isVaultApproved) {
        setIsTxFirstStep(true)
        await updateOperator(vaultId, shortHelper, () => {
          setIsVaultApproved(true)
        })
      } else {
        await openShort(vaultId, amount, collateral, () => {
          setIsTxFirstStep(false)
          setConfirmedAmount(amount.toFixed(6).toString())
          setTradeSuccess(true)
          setTradeCompleted(true)
          resetEthTradeAmount()
          setVaultHistoryUpdating(true)
          vaultHistoryQuery.refetch({ vaultId })
          updateVault()
        })
      }
    } catch (e) {
      console.log(e)
      setShortLoading(false)
    }
  }, [
    vaultIDLoading,
    vaultId,
    isVaultApproved,
    shortHelper,
    amount,
    collateral,
    openShort,
    resetEthTradeAmount,
    setIsTxFirstStep,
    setTradeCompleted,
    setTradeSuccess,
    setVaultHistoryUpdating,
    updateOperator,
    updateVault,
    vaultHistoryQuery,
  ])

  useAppEffect(() => {
    if (transactionInProgress) {
      setShortLoading(false)
    }
  }, [transactionInProgress])

  useAppEffect(() => {
    if (shortVaults.length && open && tradeType === TradeType.SHORT) {
      const _collat: BigNumber = shortVaults[firstValidVault].collateralAmount
      setExistingCollat(_collat)
      const restOfShort = new BigNumber(shortVaults[firstValidVault].shortAmount).minus(amount)

      getDebtAmount(new BigNumber(restOfShort)).then((debt) => {
        const _neededCollat = debt.times(collatPercent / 100)
        setNeededCollat(_neededCollat)
      })
    }
  }, [amount, collatPercent, shortVaults, open, tradeType, firstValidVault, getDebtAmount])

  const ethPrice = useETHPrice()
  const setCollatRatio = useUpdateAtom(collatRatioAtom)

  let openError: string | undefined
  // let closeError: string | undefined
  let existingLongError: string | undefined
  let priceImpactWarning: string | undefined
  let vaultIdDontLoadedError: string | undefined

  if (connected) {
    if (
      shortVaults.length &&
      (shortVaults[firstValidVault].shortAmount.lt(amount) || shortVaults[firstValidVault].shortAmount.isZero())
    ) {
      // closeError = 'Close amount exceeds position'
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
      // closeError = `You must have at least ${MIN_COLLATERAL_AMOUNT} ETH collateral unless you fully close out your position. Either fully close your position, or close out less`
    }
    if (isLong) {
      existingLongError = 'Close your long position to open a short'
    }
  }

  const shortOpenPriceImpactErrorState =
    priceImpactWarning && !shortLoading && !(collatPercent < 150) && !openError && !existingLongError

  useAppEffect(() => {
    setCollatRatio(collatPercent / 100)
  }, [collatPercent, setCollatRatio])

  return (
    <div id="open-short-card">
      {confirmed && !isTxFirstStep ? (
        <div>
          <Confirmed
            confirmationMessage={`Opened ${confirmedAmount} Squeeth Short Position`}
            txnHash={transactionData?.hash ?? ''}
            confirmType={ConfirmType.TRADE}
          />
          <div className={classes.buttonDiv}>
            <PrimaryButton
              variant="contained"
              onClick={() => {
                resetTransactionData()
              }}
              className={classes.amountInput}
              style={{ width: '300px' }}
              id="open-short-close-btn"
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
          <div className={classes.settingsContainer} id="open-short-card-content">
            <Typography variant="caption" className={classes.explainer} component="div" id="open-short-header-box">
              Mint & sell squeeth for premium
            </Typography>
            <span className={classes.settingsButton}>
              <TradeSettings />
            </span>
          </div>
          <div className={classes.thirdHeading}>
            <PrimaryInput
              value={ethTradeAmount}
              onChange={(v) => setEthTradeAmount(v)}
              label="Collateral"
              tooltip={Tooltips.SellOpenAmount}
              actionTxt="Max"
              onActionClicked={() => setEthTradeAmount(balance.toString())}
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
                    <span>
                      Balance <span id="open-short-eth-before-trade-balance">{balance.toFixed(4)}</span>{' '}
                    </span>
                    {!collateral.isNaN() ? (
                      <>
                        <ArrowRightAltIcon className={classes.arrowIcon} />
                        <span id="open-short-eth-post-trade-balance">
                          {new BigNumber(balance).minus(collateral).toFixed(4)}
                        </span>{' '}
                      </>
                    ) : null}
                    <span style={{ marginLeft: '4px' }}>ETH</span>
                  </div>
                )
              }
              id="open-short-eth-input"
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
              className="open-short-collat-ratio-input-box"
            />
          </div>
          <div className={classes.thirdHeading}></div>
          <CollatRange
            onCollatValueChange={(val) => setCollatPercent(val)}
            collatValue={collatPercent}
            id="open-short-collat-ratio"
          />{' '}
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
                    <span id="open-short-osqth-before-trade-balance">
                      {shortSqueethAmount.toFixed(4)}
                      {/* {shortVaults.length && shortVaults[firstValidVault].shortAmount.toFixed(6)} */}
                    </span>
                  </span>
                  {quote.amountOut.gt(0) ? (
                    <>
                      <ArrowRightAltIcon className={classes.arrowIcon} />
                      <span id="open-short-osqth-post-trade-balance">{shortSqueethAmount.plus(amount).toFixed(4)}</span>
                    </>
                  ) : null}{' '}
                  <span style={{ marginLeft: '4px' }}>oSQTH</span>
                </div>
              )
            }
            id="open-short-trade-details"
          />
          <div className={classes.divider}>
            <TradeInfoItem
              label="Liquidation Price"
              value={liqPrice.toFixed(2)}
              unit="USDC"
              tooltip={`${Tooltips.LiquidationPrice}. ${Tooltips.Twap}`}
              priceType="twap"
              id="open-short-liquidation-price"
            />
            <TradeInfoItem
              label="Initial Premium"
              value={quote.amountOut.toFixed(4)}
              unit="ETH"
              tooltip={Tooltips.InitialPremium}
              id="open-short-initial-preminum"
            />
            <TradeInfoItem
              label="Current Collateral ratio"
              value={existingCollatPercent}
              unit="%"
              tooltip={Tooltips.CurrentCollRatio}
              id="open-short-collat-ratio"
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
                style={{ width: '300px' }}
                id="open-short-connect-wallet-btn"
              >
                {'Connect Wallet'}
              </PrimaryButton>
            ) : (
              <PrimaryButton
                onClick={depositAndShort}
                className={classes.amountInput}
                disabled={
                  !supportedNetwork ||
                  ethTradeAmount === '0' ||
                  shortLoading ||
                  transactionInProgress ||
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
                id="open-short-submit-tx-btn"
              >
                {!supportedNetwork ? (
                  'Unsupported Network'
                ) : shortLoading || transactionInProgress ? (
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
      )}
    </div>
  )
}

const CloseShort: React.FC<SellType> = ({ open }) => {
  const [confirmedAmount, setConfirmedAmount] = useState('')
  const [collatPercent, setCollatPercent] = useState(200)
  const [existingCollat, setExistingCollat] = useState(new BigNumber(0))
  const [isVaultApproved, setIsVaultApproved] = useState(true)
  const [finalShortAmount, setFinalShortAmount] = useState(new BigNumber(0))
  const [buyLoading, setBuyLoading] = useState(false)
  const [withdrawCollat, setWithdrawCollat] = useState(new BigNumber(0))
  const [neededCollat, setNeededCollat] = useState(new BigNumber(0))
  const [closeType, setCloseType] = useState(CloseType.FULL)
  const [isTxFirstStep, setIsTxFirstStep] = useAtom(isTransactionFirstStepAtom)

  const classes = useStyles()
  const {
    cancelled,
    confirmed,
    loading: transactionInProgress,
    transactionData,
    resetTransactionData,
    resetTxCancelled,
  } = useTransactionStatus()

  const { closeShort } = useShortHelper()
  const getWSqueethPositionValue = useGetWSqueethPositionValue()
  const { shortHelper } = useAtomValue(addressesAtom)
  const isLong = useAtomValue(isLongAtom)
  const connected = useAtomValue(connectedWalletAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)

  const selectWallet = useSelectWallet()
  const updateOperator = useUpdateOperator()
  const getDebtAmount = useGetDebtAmount()
  const getBuyQuote = useGetBuyQuote()
  const setTradeCompleted = useUpdateAtom(tradeCompletedAtom)

  const quote = useAtomValue(quoteAtom)
  const [sellCloseQuote, setSellCloseQuote] = useAtom(sellCloseQuoteAtom)
  const [sqthTradeAmount, setSqthTradeAmount] = useAtom(sqthTradeAmountAtom)
  const resetSqthTradeAmount = useResetAtom(sqthTradeAmountAtom)

  const setTradeSuccess = useUpdateAtom(tradeSuccessAtom)
  const slippageAmount = useAtomValue(slippageAmountAtom)
  const tradeType = useAtomValue(tradeTypeAtom)
  const amount = useAppMemo(() => new BigNumber(sqthTradeAmount), [sqthTradeAmount])
  const { data } = useWalletBalance()
  const balance = Number(toTokenAmount(data ?? BIG_ZERO, 18).toFixed(4))

  const { loading: isPositionFinishedCalc } = useLPPositionsQuery()
  const { vaults: shortVaults } = useVaultManager()
  const { firstValidVault, vaultId } = useFirstValidVault()
  const { existingCollatPercent, updateVault } = useVaultData(vaultId)
  const vaultQuery = useVaultQuery(vaultId)
  const vault = vaultQuery.data
  const setCollatRatio = useUpdateAtom(collatRatioAtom)
  const ethPrice = useETHPrice()
  const [isVaultHistoryUpdating, setVaultHistoryUpdating] = useAtom(vaultHistoryUpdatingAtom)
  const vaultHistoryQuery = useVaultHistoryQuery(vaultId, isVaultHistoryUpdating)

  useAppEffect(() => {
    if (vault) {
      const contractShort = vault?.shortAmount?.isFinite() ? vault?.shortAmount : new BigNumber(0)
      setFinalShortAmount(contractShort)
    }
  }, [vault])

  // useAppEffect(() => {
  //   if (shortVaults[firstValidVault]?.shortAmount && shortVaults[firstValidVault]?.shortAmount.lt(amount)) {
  //     console.log('looking for something weird')
  //     setSqthTradeAmount(shortVaults[firstValidVault]?.shortAmount.toString())
  //   }
  // }, [vault?.shortAmount.toString(), amount.toString()])

  useAppEffect(() => {
    if (!vaultId) return

    setIsVaultApproved(shortVaults[firstValidVault].operator?.toLowerCase() === shortHelper?.toLowerCase())
  }, [vaultId, shortHelper, firstValidVault, shortVaults])

  useAppEffect(() => {

    if (amount.isEqualTo(0)) {
      setExistingCollat(new BigNumber(0))
      setNeededCollat(new BigNumber(0))
      setWithdrawCollat(new BigNumber(0))
    }
  }, [amount])

  useAppEffect(() => {
    if (shortVaults.length && !amount.isEqualTo(0)) {
      const _collat: BigNumber = vault?.collateralAmount ?? new BigNumber(0)
      setExistingCollat(_collat)
      const restOfShort = new BigNumber(vault?.shortAmount ?? new BigNumber(0)).minus(amount)

      getDebtAmount(new BigNumber(restOfShort)).then((debt) => {
        const _neededCollat = debt.times(collatPercent / 100)
        setNeededCollat(_neededCollat)
        setWithdrawCollat(_neededCollat.gt(0) ? _collat.minus(neededCollat) : _collat)
      })
    }
  }, [
    amount,
    shortVaults?.length,
    collatPercent,
    vault?.collateralAmount,
    vault?.shortAmount,
    getDebtAmount,
    neededCollat,
  ])

  useAppEffect(() => {
    if (transactionInProgress) {
      setBuyLoading(false)
    }
  }, [transactionInProgress])

  const buyBackAndClose = useAppCallback(async () => {
    setBuyLoading(true)

    try {
      if (vaultId && !isVaultApproved) {
        setIsTxFirstStep(true)
        await updateOperator(vaultId, shortHelper, () => {
          setIsVaultApproved(true)
        })
      } else {
        const _collat: BigNumber = vault?.collateralAmount ?? new BigNumber(0)
        const restOfShort = new BigNumber(vault?.shortAmount ?? new BigNumber(0)).minus(amount)
        const _debt: BigNumber = await getDebtAmount(new BigNumber(restOfShort))
        const neededCollat = _debt.times(collatPercent / 100)
        await closeShort(vaultId, amount, _collat.minus(neededCollat), async () => {
          setIsTxFirstStep(false)
          setConfirmedAmount(amount.toFixed(6).toString())
          setTradeSuccess(true)
          setTradeCompleted(true)
          resetSqthTradeAmount()
          setIsVaultApproved(false)
          vaultQuery.refetch({ vaultID: vault!.id })
          setVaultHistoryUpdating(true)
          updateVault()
          vaultHistoryQuery.refetch({ vaultId })
        })
      }
    } catch (e) {
      console.log(e)
      setBuyLoading(false)
    }
  }, [
    vaultId,
    amount,
    isVaultApproved,
    collatPercent,
    closeShort,
    getDebtAmount,
    resetSqthTradeAmount,
    setIsTxFirstStep,
    setTradeCompleted,
    setTradeSuccess,
    shortHelper,
    updateOperator,
    vault,
    vaultQuery,
    setVaultHistoryUpdating,
    updateVault,
    vaultHistoryQuery,
  ])

  const setShortCloseMax = useAppCallback(() => {
    if (finalShortAmount.isGreaterThan(0)) {
      setSqthTradeAmount(finalShortAmount.toString())
      setCollatPercent(150)
      setCloseType(CloseType.FULL)
    }
  }, [finalShortAmount, setSqthTradeAmount])

  // let openError: string | undefined
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
    if (amount.isGreaterThan(0) && existingCollat.lt(MIN_COLLATERAL_AMOUNT)) {
      // openError = `Minimum collateral is ${MIN_COLLATERAL_AMOUNT} ETH`
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

  useAppEffect(() => {
    setCollatRatio(collatPercent / 100)
  }, [collatPercent, setCollatRatio])

  useAppEffect(() => {
    getBuyQuote(amount, slippageAmount).then(setSellCloseQuote)
  }, [amount, slippageAmount, getBuyQuote, setSellCloseQuote])

  useAppEffect(() => {
    if (finalShortAmount.isGreaterThan(0)) {
      setSqthTradeAmount(finalShortAmount.toString())
      setCollatPercent(150)
      setCloseType(CloseType.FULL)
    }
  }, [tradeType, open, finalShortAmount, setSqthTradeAmount])

  const handleAmountInput = (v: string) => {
    setSqthTradeAmount(v)
  }

  return (
    <div id="close-short-card">
      {confirmed && !isTxFirstStep ? (
        <div>
          <Confirmed
            confirmationMessage={`Closed ${confirmedAmount} Squeeth Short Position`}
            txnHash={transactionData?.hash ?? ''}
            confirmType={ConfirmType.TRADE}
          />
          <div className={classes.buttonDiv}>
            <PrimaryButton
              variant="contained"
              onClick={() => {
                resetTransactionData()
              }}
              className={classes.amountInput}
              style={{ width: '300px' }}
              id="close-short-close-btn"
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
          <div className={classes.settingsContainer}>
            <Typography variant="caption" className={classes.explainer} component="div" id="close-short-header-box">
              Buy back oSQTH & close position
            </Typography>
            <span className={classes.settingsButton}>
              <TradeSettings />
            </span>
          </div>
          <div className={classes.thirdHeading}>
            <PrimaryInput
              isFullClose={closeType === CloseType.FULL}
              value={sqthTradeAmount}
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
                      <span className={classes.hintTitleText}>Position</span>{' '}
                      <span id="close-short-osqth-before-trade-balance">{finalShortAmount.toFixed(6)}</span>{' '}
                    </span>
                    {amount.toNumber() ? (
                      <>
                        <ArrowRightAltIcon className={classes.arrowIcon} />
                        <span id="close-short-osqth-post-trade-balance">
                          {finalShortAmount?.minus(amount).toFixed(6)}
                        </span>
                      </>
                    ) : null}{' '}
                    <span style={{ marginLeft: '4px' }}>oSQTH</span>
                  </div>
                )
              }
              id="close-short-osqth-input"
            />
          </div>
          <div style={{ width: '100%', padding: '0 25px 5px 25px' }} id="close-short-type-select">
            <Select
              label="Type of Close"
              value={closeType}
              onChange={(event: React.ChangeEvent<{ value: unknown }>) => {
                if (event.target.value === CloseType.FULL) {
                  setShortCloseMax()
                } else {
                  setSqthTradeAmount('0')
                }
                setCollatPercent(200)
                return setCloseType(event.target.value as CloseType)
              }}
              displayEmpty
              inputProps={{ 'aria-label': 'Without label' }}
              style={{ padding: '5px 0px', width: '100%', textAlign: 'left' }}
              id="close-short-type-select"
            >
              <MenuItem value={CloseType.FULL} id="close-short-full-close">
                Full Close
              </MenuItem>
              <MenuItem value={CloseType.PARTIAL} id="close-short-partial-close">
                Partial Close
              </MenuItem>
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
                className="close-short-collat-ratio-input-box"
              />
              <CollatRange
                className={classes.thirdHeading}
                onCollatValueChange={(val) => setCollatPercent(val)}
                collatValue={collatPercent}
                id="close-short-collat-ratio"
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
                  <span>
                    Balance <span id="close-short-eth-before-trade-balance">{balance}</span>{' '}
                  </span>
                  {amount.toNumber() ? (
                    <>
                      <ArrowRightAltIcon className={classes.arrowIcon} />
                      <span id="close-short-eth-post-trade-balance">
                        {new BigNumber(balance).minus(sellCloseQuote.amountIn).toFixed(6)}
                      </span>
                    </>
                  ) : existingLongError ? (
                    existingLongError
                  ) : null}{' '}
                  <span style={{ marginLeft: '4px' }}>ETH</span>
                </div>
              )
            }
            id="close-short-trade-details"
          />
          <div className={classes.divider}>
            <TradeInfoItem
              label="Collateral you redeem"
              value={withdrawCollat.isPositive() ? withdrawCollat.toFixed(4) : 0}
              unit="ETH"
              id="close-short-collateral-to-redeem"
            />
            <TradeInfoItem
              label="Current Collateral ratio"
              value={existingCollatPercent}
              unit="%"
              tooltip={Tooltips.CurrentCollRatio}
              id="close-short-collateral-ratio"
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
                id="close-short-connect-wallet-btn"
              >
                {'Connect Wallet'}
              </PrimaryButton>
            ) : (
              <PrimaryButton
                onClick={buyBackAndClose}
                className={classes.amountInput}
                disabled={
                  !supportedNetwork ||
                  sqthTradeAmount === '0' ||
                  buyLoading ||
                  transactionInProgress ||
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
                id="close-short-submit-tx-btn"
              >
                {!supportedNetwork ? (
                  'Unsupported Network'
                ) : buyLoading || transactionInProgress ? (
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
      )}
    </div>
  )
}

type SellType = {
  open: boolean
}

const Short: React.FC<SellType> = ({ open }) => {
  return open ? <OpenShort open={open} /> : <CloseShort open={open} />
}

export default memo(Short)

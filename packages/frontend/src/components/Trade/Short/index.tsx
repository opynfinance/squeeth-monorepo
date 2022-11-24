import { makeStyles, createStyles } from '@material-ui/core/styles'
import {
  InputAdornment,
  Box,
  Tooltip,
  Typography,
  Select,
  MenuItem,
  CircularProgress,
  Collapse,
} from '@material-ui/core'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'
import BigNumber from 'bignumber.js'
import React, { memo, useState, useEffect } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import { atomFamily, atomWithStorage, useResetAtom, useUpdateAtom } from 'jotai/utils'

import { CloseType, Tooltips } from '@constants/enums'
import useShortHelper from '@hooks/contracts/useShortHelper'
import { useVaultManager } from '@hooks/contracts/useVaultManager'
import { PrimaryButtonNew } from '@components/Button'
import { InputToken, InputNumber } from '@components/InputNew'
import Alert from '@components/Alert'
import { TradeSettings } from '@components/TradeSettings'
import Confirmed, { ConfirmType } from '@components/Trade/Confirmed'
import { BIG_ZERO, MIN_COLLATERAL_AMOUNT } from '@constants/index'
import { connectedWalletAtom, isTransactionFirstStepAtom, supportedNetworkAtom } from '@state/wallet/atoms'
import { useSelectWallet, useTransactionStatus, useWalletBalance } from '@state/wallet/hooks'
import { addressesAtom, isLongAtom, vaultHistoryUpdatingAtom } from '@state/positions/atoms'
import { useETHPrice } from '@hooks/useETHPrice'
import { useOSQTHPrice } from '@hooks/useOSQTHPrice'
import { collatRatioAtom } from '@state/ethPriceCharts/atoms'
import { useGetBuyQuote, useGetSellQuote } from '@state/squeethPool/hooks'
import {
  useGetCollatRatioAndLiqPrice,
  useGetDebtAmount,
  useGetShortAmountFromDebt,
  useUpdateOperator,
} from '@state/controller/hooks'
import { useComputeSwaps, useFirstValidVault } from '@state/positions/hooks'
import {
  ethTradeAmountAtom,
  quoteAtom,
  sellCloseQuoteAtom,
  slippageAmountAtom,
  sqthTradeAmountAtom,
  tradeCompletedAtom,
  tradeSuccessAtom,
  tradeTypeAtom,
} from '@state/trade/atoms'
import { toTokenAmount } from '@utils/calculations'
import { currentImpliedFundingAtom, dailyHistoricalFundingAtom, normFactorAtom } from '@state/controller/atoms'
import { TradeType } from 'src/types'
import Cancelled from '../Cancelled'
import { useVaultData } from '@hooks/useVaultData'
import useAppEffect from '@hooks/useAppEffect'
import useAppCallback from '@hooks/useAppCallback'
import { useVaultHistoryQuery } from '@hooks/useVaultHistory'
import useAppMemo from '@hooks/useAppMemo'
import Metric from '@components/Metric'
import ethLogo from 'public/images/eth-logo.svg'
import osqthLogo from 'public/images/osqth-logo.svg'
import Checkbox from '@components/Checkbox'
import CollatRatioSlider from '@components/CollatRatioSlider'
import { formatNumber, formatCurrency } from '@utils/formatter'
import RestrictionInfo from '@components/RestrictionInfo'
import { useRestrictUser } from '@context/restrict-user'

const DEFAULT_COLLATERAL_RATIO = 225

const useStyles = makeStyles((theme) =>
  createStyles({
    subtitle: {
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    label: {
      fontSize: '18px',
      fontWeight: 700,
    },
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
      fontSize: '1rem',
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
      backgroundColor: theme.palette.background.default,
      zIndex: 1500,
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
    vaultCollatInfo: {
      display: 'flex',
      alignItems: 'center',
      pointerEvents: 'auto',
    },
  }),
)

export const collatPercentAtom = atomWithStorage('collatPercent', 0)
const collatPercentFamily = atomFamily((initialValue: number) => atomWithStorage('collatPercent', initialValue))
const FUNDING_MOVE_THRESHOLD = 0.7

const OpenShort: React.FC<SellType> = ({ open }) => {
  const [ethTradeAmount, setEthTradeAmount] = useAtom(ethTradeAmountAtom)
  const resetEthTradeAmount = useResetAtom(ethTradeAmountAtom)
  const [existingCollat, setExistingCollat] = useState(new BigNumber(0))
  const [confirmedAmount, setConfirmedAmount] = useState('')
  const [isVaultApproved, setIsVaultApproved] = useState(true)
  const [shortLoading, setShortLoading] = useState(false)
  const [liqPrice, setLiqPrice] = useState(new BigNumber(0))
  const [neededCollat, setNeededCollat] = useState(new BigNumber(0))
  // const [collatError, setCollatError] = useState('')

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

  const getSellQuote = useGetSellQuote()
  const { data } = useWalletBalance()
  const balance = Number(toTokenAmount(data ?? BIG_ZERO, 18).toFixed(4))

  const connected = useAtomValue(connectedWalletAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const selectWallet = useSelectWallet()
  const { isRestricted } = useRestrictUser()

  const { shortHelper } = useAtomValue(addressesAtom)
  const setTradeCompleted = useUpdateAtom(tradeCompletedAtom)

  const updateOperator = useUpdateOperator()
  const getShortAmountFromDebt = useGetShortAmountFromDebt()
  const getCollatRatioAndLiqPrice = useGetCollatRatioAndLiqPrice()
  const getDebtAmount = useGetDebtAmount()
  const setTradeSuccess = useUpdateAtom(tradeSuccessAtom)
  const dailyHistoricalFunding = useAtomValue(dailyHistoricalFundingAtom)
  const currentImpliedFunding = useAtomValue(currentImpliedFundingAtom)

  const [usingDefaultCollatRatio, setUsingDefaultCollatRatio] = useState(true)

  const [quote, setQuote] = useAtom(quoteAtom)
  const [sqthTradeAmount, setSqthTradeAmount] = useAtom(sqthTradeAmountAtom)
  const [isTxFirstStep, setIsTxFirstStep] = useAtom(isTransactionFirstStepAtom)
  const normalizationFactor = useAtomValue(normFactorAtom)

  const [slippageAmount, setSlippage] = useAtom(slippageAmountAtom)
  const tradeType = useAtomValue(tradeTypeAtom)
  const amount = useAppMemo(() => new BigNumber(sqthTradeAmount), [sqthTradeAmount])
  const collateral = useAppMemo(() => new BigNumber(ethTradeAmount), [ethTradeAmount])
  const isLong = useAtomValue(isLongAtom)

  const { updateVault, vaults: shortVaults, loading: vaultIDLoading } = useVaultManager()
  const { validVault: vault, vaultId } = useFirstValidVault()
  const { squeethAmount: shortSqueethAmount } = useComputeSwaps()
  const [isVaultHistoryUpdating, setVaultHistoryUpdating] = useAtom(vaultHistoryUpdatingAtom)
  const { existingCollatPercent } = useVaultData(vault)
  const collatPercentAtom = collatPercentFamily(200)
  const [collatPercent, setCollatPercent] = useAtom(collatPercentAtom)
  const vaultHistoryQuery = useVaultHistoryQuery(Number(vaultId), isVaultHistoryUpdating)

  useAppEffect(() => {
    getSellQuote(amount, slippageAmount).then(setQuote)
  }, [amount, slippageAmount, getSellQuote, setQuote])

  useAppEffect(() => {
    getCollatRatioAndLiqPrice(collateral, amount).then(({ liquidationPrice }) => {
      setLiqPrice(liquidationPrice)
    })
  }, [collateral, amount, getCollatRatioAndLiqPrice, vault?.shortAmount])

  // useAppEffect(() => {
  //   if (!open && shortVaults.length && shortVaults[firstValidVault].shortAmount.lt(amount)) {
  //     setSqthTradeAmount(shortVaults[firstValidVault].shortAmount.toString())
  //   }
  // }, [shortVaults?.length, open])

  useAppEffect(() => {
    const debt = collateral.times(100).dividedBy(new BigNumber(collatPercent))
    getShortAmountFromDebt(debt).then((s) => setSqthTradeAmount(s.toString()))
  }, [collatPercent, collateral, normalizationFactor, tradeType, open, getShortAmountFromDebt, setSqthTradeAmount])

  useAppEffect(() => {
    if (!vault) return

    setIsVaultApproved(vault.operator?.toLowerCase() === shortHelper?.toLowerCase())
  }, [shortHelper, vault])

  const depositAndShort = useAppCallback(async () => {
    setShortLoading(true)
    try {
      if (vaultIDLoading) {
        setShortLoading(false)
        return
      }
      if (vaultId && !isVaultApproved) {
        setIsTxFirstStep(true)
        await updateOperator(Number(vaultId), shortHelper, () => {
          setIsVaultApproved(true)
        })
      } else {
        await openShort(Number(vaultId), amount, collateral, () => {
          setIsTxFirstStep(false)
          setConfirmedAmount(amount.toFixed(6).toString())
          setTradeSuccess(true)
          setTradeCompleted(true)
          resetEthTradeAmount()
          setVaultHistoryUpdating(true)
          vaultHistoryQuery.refetch({ vaultId })
          localStorage.removeItem('collatPercent')
          updateVault()
        })
      }
    } catch (e) {
      console.log(e)
      setShortLoading(false)
    }
  }, [
    amount,
    updateVault,
    collateral,
    isVaultApproved,
    openShort,
    resetEthTradeAmount,
    setIsTxFirstStep,
    setTradeCompleted,
    setTradeSuccess,
    setVaultHistoryUpdating,
    shortHelper,
    updateOperator,
    vaultHistoryQuery,
    vaultIDLoading,
    vaultId,
  ])

  useAppEffect(() => {
    if (transactionInProgress) {
      setShortLoading(false)
    }
  }, [transactionInProgress])

  useAppEffect(() => {
    if (vault && open && tradeType === TradeType.SHORT) {
      const _collat: BigNumber = vault.collateralAmount
      setExistingCollat(_collat)
      const restOfShort = new BigNumber(vault.shortAmount).minus(amount)

      getDebtAmount(new BigNumber(restOfShort)).then((debt) => {
        const _neededCollat = debt.times(collatPercent / 100)
        setNeededCollat(_neededCollat)
      })
    }
  }, [amount, collatPercent, shortVaults, open, tradeType, getDebtAmount, vault])

  const ethPrice = useETHPrice()
  const { data: osqthPrice } = useOSQTHPrice()
  const setCollatRatio = useUpdateAtom(collatRatioAtom)

  let openError: string | undefined
  // let closeError: string | undefined
  let existingLongError: string | undefined
  let priceImpactWarning: string | undefined
  let vaultIdDontLoadedError: string | undefined
  let lowVolError: string | undefined

  if (connected) {
    if (vault && (vault.shortAmount.lt(amount) || vault.shortAmount.isZero())) {
      // closeError = 'Close amount exceeds position'
    }
    if (new BigNumber(quote.priceImpact).gt(3)) {
      priceImpactWarning = 'High Price Impact'
    }
    if (collateral.isGreaterThan(new BigNumber(balance))) {
      openError = 'Insufficient ETH balance'
    } else if (amount.isGreaterThan(0) && collateral.plus(existingCollat).lt(MIN_COLLATERAL_AMOUNT)) {
      openError = `Minimum collateral is ${MIN_COLLATERAL_AMOUNT} ETH`
    } else if (vault && vaultId === 0 && vault?.shortAmount.gt(0)) {
      vaultIdDontLoadedError = 'Loading Vault...'
    }
    console.log(currentImpliedFunding, FUNDING_MOVE_THRESHOLD * dailyHistoricalFunding.funding, Number(amount) > 0)
    if (currentImpliedFunding <= FUNDING_MOVE_THRESHOLD * dailyHistoricalFunding.funding && Number(amount) > 0) {
      const fundingPercent = (1 - currentImpliedFunding / dailyHistoricalFunding.funding) * 100
      lowVolError = `Premiums are ${fundingPercent.toFixed(0)}% below yesterday. Consider buying later`
    }
    if (
      !open &&
      amount.isGreaterThan(0) &&
      vault &&
      amount.lt(vault.shortAmount) &&
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

  const error = existingLongError
    ? existingLongError
    : priceImpactWarning
    ? priceImpactWarning
    : lowVolError
    ? lowVolError
    : ''

  const handleDefaultCollatRatioToggle = useAppCallback(
    (value: boolean) => {
      if (value) {
        setCollatPercent(DEFAULT_COLLATERAL_RATIO)
      }
      setUsingDefaultCollatRatio(value)
    },
    [setCollatPercent],
  )

  useEffect(() => {
    if (collatPercent !== DEFAULT_COLLATERAL_RATIO) {
      setUsingDefaultCollatRatio(false)
    }
  }, [collatPercent])

  useAppEffect(() => {
    setCollatRatio(collatPercent / 100)
  }, [collatPercent, setCollatRatio])

  const slippageAmountValue = isNaN(slippageAmount.toNumber()) ? 0 : slippageAmount.toNumber()
  const priceImpact = isNaN(Number(quote.priceImpact)) ? 0 : Number(quote.priceImpact)
  const priceImpactColor = priceImpact > 3 ? 'error' : undefined

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
            <PrimaryButtonNew
              fullWidth
              variant="contained"
              onClick={() => {
                resetTransactionData()
              }}
              className={classes.amountInput}
              id="open-short-close-btn"
            >
              {'Close'}
            </PrimaryButtonNew>
          </div>
        </div>
      ) : cancelled ? (
        <div>
          <Cancelled txnHash={transactionData?.hash ?? ''} />
          <div className={classes.buttonDiv}>
            <PrimaryButtonNew
              fullWidth
              variant="contained"
              onClick={() => {
                resetTransactionData()
                resetTxCancelled()
              }}
              className={classes.amountInput}
            >
              {'Close'}
            </PrimaryButtonNew>
          </div>
        </div>
      ) : (
        <div>
          <Box marginTop="32px">
            <Typography variant="h4" className={classes.subtitle}>
              Use ETH collateral to mint & sell oSQTH
            </Typography>

            <Box display="flex" flexDirection="column" marginTop="8px">
              <InputToken
                id="open-short-eth-input"
                value={ethTradeAmount}
                onInputChange={(v) => setEthTradeAmount(v)}
                symbol="ETH"
                logo={ethLogo}
                balance={new BigNumber(balance)}
                usdPrice={ethPrice}
                onBalanceClick={() => setEthTradeAmount(balance.toString())}
                error={!!openError}
                helperText={openError}
              />

              <Box display="flex" justifyContent="space-between" alignItems="center" marginTop="24px">
                <Typography variant="h4" className={classes.label}>
                  Collateralization ratio
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gridGap: '16px' }}>
                  <Checkbox
                    name="priceRangeDefault"
                    label="Default"
                    isChecked={usingDefaultCollatRatio}
                    onInputChange={handleDefaultCollatRatioToggle}
                  />

                  <InputNumber
                    id="collateral-ratio-input"
                    value={collatPercent}
                    onInputChange={(value) => setCollatPercent(Number(value))}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end" style={{ opacity: '0.5' }}>
                          %
                        </InputAdornment>
                      ),
                    }}
                    style={{ width: '80px' }}
                  />
                </Box>
              </Box>

              <Box marginTop="24px">
                <CollatRatioSlider
                  collatRatio={collatPercent}
                  onCollatRatioChange={(value) => setCollatPercent(value)}
                  minCollatRatio={150}
                />

                <Box marginTop="12px">
                  <Collapse in={collatPercent <= 150}>
                    <Alert severity="error" id={'collat-ratio-slider-alert-text'}>
                      You will get liquidated.
                    </Alert>
                  </Collapse>
                  <Collapse in={collatPercent > 150 && collatPercent < 200}>
                    <Alert severity="warning" id={'collat-ratio-slider-alert-text'}>
                      Collateral ratio is too low. You will get liquidated at 150%.
                    </Alert>
                  </Collapse>

                  <Collapse in={collatPercent >= 200 && collatPercent < 225}>
                    <Alert severity="warning" id={'collat-ratio-slider-alert-text'}>
                      Collateral ratio is risky.
                    </Alert>
                  </Collapse>
                </Box>
              </Box>

              <Box display="flex" alignItems="center" gridGap="12px" marginTop="24px" flexWrap="wrap">
                <Metric label="Current Collateral Ratio" value={formatNumber(existingCollatPercent) + '%'} isSmall />
                <Metric label="Liquidation Price" value={formatCurrency(liqPrice.toNumber())} isSmall />
              </Box>

              <Box marginTop="24px">
                <InputToken
                  id="open-short-trade-details"
                  label="Sell"
                  value={!amount.isNaN() ? amount.toFixed(4) : Number(0).toLocaleString()}
                  readOnly
                  symbol="oSQTH"
                  logo={osqthLogo}
                  balance={shortSqueethAmount}
                  usdPrice={osqthPrice}
                  showMaxAction={false}
                />
              </Box>

              <Collapse in={!!error}>
                <Alert severity="error" marginTop="24px">
                  {error}
                </Alert>
              </Collapse>

              <Box marginTop="24px">
                <Metric
                  label="Initial Premium"
                  value={formatNumber(quote.amountOut.toNumber()) + ' ETH'}
                  isSmall
                  flexDirection="row"
                  justifyContent="space-between"
                />
              </Box>

              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                gridGap="12px"
                marginTop="12px"
                flexWrap="wrap"
              >
                <Metric
                  label="Slippage"
                  value={formatNumber(slippageAmountValue) + '%'}
                  isSmall
                  flexDirection="row"
                  justifyContent="space-between"
                  gridGap="12px"
                />
                <Box display="flex" alignItems="center" gridGap="12px" flex="1">
                  <Metric
                    label="Price Impact"
                    value={formatNumber(priceImpact) + '%'}
                    textColor={priceImpactColor}
                    isSmall
                    flexDirection="row"
                    justifyContent="space-between"
                    gridGap="12px"
                  />
                  <TradeSettings setSlippage={(amt) => setSlippage(amt)} slippage={slippageAmount} />
                </Box>
              </Box>
            </Box>
          </Box>

          {isRestricted && <RestrictionInfo marginTop="24px" />}

          <Box marginTop="24px" className={classes.buttonDiv}>
            {isRestricted ? (
              <PrimaryButtonNew
                fullWidth
                variant="contained"
                onClick={selectWallet}
                disabled={true}
                id="open-long-restricted-btn"
              >
                {'Unavailable'}
              </PrimaryButtonNew>
            ) : !connected ? (
              <PrimaryButtonNew
                fullWidth
                variant="contained"
                onClick={selectWallet}
                className={classes.amountInput}
                id="open-short-connect-wallet-btn"
              >
                {'Connect Wallet'}
              </PrimaryButtonNew>
            ) : (
              <PrimaryButtonNew
                fullWidth
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
                  (vault && vault.shortAmount.isZero()) ||
                  !!vaultIdDontLoadedError
                }
                variant={shortOpenPriceImpactErrorState ? 'outlined' : 'contained'}
                style={
                  shortOpenPriceImpactErrorState
                    ? { color: '#f5475c', backgroundColor: 'transparent', borderColor: '#f5475c' }
                    : {}
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
              </PrimaryButtonNew>
            )}
          </Box>
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
  const [usingDefaultCollatRatio, setUsingDefaultCollatRatio] = useState(true)

  const setTradeSuccess = useUpdateAtom(tradeSuccessAtom)
  const [slippageAmount, setSlippage] = useAtom(slippageAmountAtom)
  const tradeType = useAtomValue(tradeTypeAtom)
  const amount = useAppMemo(() => new BigNumber(sqthTradeAmount), [sqthTradeAmount])
  const { data } = useWalletBalance()
  const balance = Number(toTokenAmount(data ?? BIG_ZERO, 18).toFixed(4))

  const { updateVault } = useVaultManager()
  const { validVault: vault, vaultId } = useFirstValidVault()
  const { existingCollatPercent } = useVaultData(vault)
  const setCollatRatio = useUpdateAtom(collatRatioAtom)
  const ethPrice = useETHPrice()
  const { data: osqthPrice } = useOSQTHPrice()
  const [isVaultHistoryUpdating, setVaultHistoryUpdating] = useAtom(vaultHistoryUpdatingAtom)
  const vaultHistoryQuery = useVaultHistoryQuery(Number(vaultId), isVaultHistoryUpdating)
  const { isRestricted } = useRestrictUser()

  useAppEffect(() => {
    if (vault) {
      const contractShort = vault?.shortAmount?.isFinite() ? vault?.shortAmount : new BigNumber(0)
      setFinalShortAmount(contractShort)
    }
  }, [vault, vault?.shortAmount])

  // useAppEffect(() => {
  //   if (shortVaults[firstValidVault]?.shortAmount && shortVaults[firstValidVault]?.shortAmount.lt(amount)) {
  //     console.log('looking for something weird')
  //     setSqthTradeAmount(shortVaults[firstValidVault]?.shortAmount.toString())
  //   }
  // }, [vault?.shortAmount.toString(), amount.toString()])

  useAppEffect(() => {
    if (!vault) return

    setIsVaultApproved(vault?.operator?.toLowerCase() === shortHelper?.toLowerCase())
  }, [vaultId, shortHelper, vault])

  useAppEffect(() => {
    if (amount.isEqualTo(0)) {
      setExistingCollat(new BigNumber(0))
      setNeededCollat(new BigNumber(0))
      setWithdrawCollat(new BigNumber(0))
    }
  }, [amount])

  useAppEffect(() => {
    if (vault && !amount.isEqualTo(0)) {
      const _collat: BigNumber = vault?.collateralAmount ?? new BigNumber(0)
      setExistingCollat(_collat)
      const restOfShort = new BigNumber(vault.shortAmount ?? new BigNumber(0)).minus(amount)

      getDebtAmount(new BigNumber(restOfShort)).then((debt) => {
        const _neededCollat = debt.times(collatPercent / 100)
        setNeededCollat(_neededCollat)
        setWithdrawCollat(_neededCollat.gt(0) ? _collat.minus(neededCollat) : _collat)
      })
    }
  }, [amount, collatPercent, getDebtAmount, neededCollat, vault])

  useAppEffect(() => {
    if (transactionInProgress) {
      setBuyLoading(false)
    }
  }, [transactionInProgress])

  const handleDefaultCollatRatioToggle = useAppCallback(
    (value: boolean) => {
      if (value) {
        setCollatPercent(DEFAULT_COLLATERAL_RATIO)
      }
      setUsingDefaultCollatRatio(value)
    },
    [setCollatPercent],
  )

  useEffect(() => {
    if (collatPercent !== DEFAULT_COLLATERAL_RATIO) {
      setUsingDefaultCollatRatio(false)
    }
  }, [collatPercent])

  const buyBackAndClose = useAppCallback(async () => {
    setBuyLoading(true)

    try {
      if (vaultId && !isVaultApproved) {
        setIsTxFirstStep(true)
        await updateOperator(Number(vaultId), shortHelper, () => {
          setIsVaultApproved(true)
        })
      } else {
        const _collat: BigNumber = vault?.collateralAmount ?? new BigNumber(0)
        const restOfShort = new BigNumber(vault?.shortAmount ?? new BigNumber(0)).minus(amount)
        const _debt: BigNumber = await getDebtAmount(new BigNumber(restOfShort))
        const neededCollat = _debt.times(collatPercent / 100)
        await closeShort(Number(vaultId), amount, _collat.minus(neededCollat), async () => {
          setIsTxFirstStep(false)
          setConfirmedAmount(amount.toFixed(6).toString())
          setTradeSuccess(true)
          setTradeCompleted(true)
          resetSqthTradeAmount()
          setIsVaultApproved(false)
          localStorage.removeItem('collatPercent')
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
    amount,
    updateVault,
    closeShort,
    collatPercent,
    getDebtAmount,
    isVaultApproved,
    resetSqthTradeAmount,
    setIsTxFirstStep,
    setTradeCompleted,
    setTradeSuccess,
    setVaultHistoryUpdating,
    shortHelper,
    updateOperator,
    vault?.collateralAmount,
    vault?.shortAmount,
    vaultHistoryQuery,
    vaultId,
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
      vault &&
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
    vault &&
    !vault.shortAmount.isZero()

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

  const error = closeError
    ? closeError
    : existingLongError
    ? existingLongError
    : priceImpactWarning
    ? priceImpactWarning
    : insufficientETHBalance
    ? insufficientETHBalance
    : ''

  const slippageAmountValue = isNaN(slippageAmount.toNumber()) ? 0 : slippageAmount.toNumber()
  const priceImpact = isNaN(Number(sellCloseQuote.priceImpact)) ? 0 : Number(sellCloseQuote.priceImpact)
  const priceImpactColor = priceImpact > 3 ? 'error' : undefined

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
            <PrimaryButtonNew
              fullWidth
              variant="contained"
              onClick={() => {
                resetTransactionData()
              }}
              className={classes.amountInput}
              id="close-short-close-btn"
            >
              {'Close'}
            </PrimaryButtonNew>
          </div>
        </div>
      ) : cancelled ? (
        <div>
          <Cancelled txnHash={transactionData?.hash ?? ''} />
          <div className={classes.buttonDiv}>
            <PrimaryButtonNew
              fullWidth
              variant="contained"
              onClick={() => {
                resetTransactionData()
                resetTxCancelled()
              }}
              className={classes.amountInput}
            >
              {'Close'}
            </PrimaryButtonNew>
          </div>
        </div>
      ) : (
        <Box marginTop="32px">
          <Typography variant="h4" className={classes.subtitle}>
            Buy back oSQTH & close position
          </Typography>

          <Box display="flex" flexDirection="column" marginTop="8px">
            <InputToken
              id="close-short-osqth-input"
              value={sqthTradeAmount}
              onInputChange={(v) => handleAmountInput(v)}
              symbol="oSQTH"
              logo={osqthLogo}
              balance={finalShortAmount}
              usdPrice={osqthPrice}
              onBalanceClick={() => handleAmountInput(finalShortAmount.toString())}
              error={!!closeError}
              helperText={closeError}
              readOnly={closeType === CloseType.FULL}
              readOnlyTooltip={closeType === CloseType.FULL ? Tooltips.FullcloseInput : ''}
            />

            <Box marginTop="24px">
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
                MenuProps={{
                  disableScrollLock: true,
                }}
              >
                <MenuItem value={CloseType.FULL} id="close-short-full-close">
                  Full Close
                </MenuItem>
                <MenuItem value={CloseType.PARTIAL} id="close-short-partial-close">
                  Partial Close
                </MenuItem>
              </Select>
            </Box>

            {closeType === CloseType.PARTIAL && (
              <>
                <Box display="flex" justifyContent="space-between" alignItems="center" marginTop="24px">
                  <Typography variant="h4" className={classes.label}>
                    Collateralization ratio
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', gridGap: '16px' }}>
                    <Checkbox
                      name="priceRangeDefault"
                      label="Default"
                      isChecked={usingDefaultCollatRatio}
                      onInputChange={handleDefaultCollatRatioToggle}
                    />

                    <InputNumber
                      id="collateral-ratio-input"
                      value={collatPercent}
                      onInputChange={(value) => setCollatPercent(Number(value))}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end" style={{ opacity: '0.5' }}>
                            %
                          </InputAdornment>
                        ),
                      }}
                      style={{ width: '80px' }}
                    />
                  </Box>
                </Box>

                <Box marginTop="24px">
                  <CollatRatioSlider
                    collatRatio={collatPercent}
                    onCollatRatioChange={(value) => setCollatPercent(value)}
                    minCollatRatio={150}
                  />

                  <Box marginTop="12px">
                    <Collapse in={collatPercent <= 150}>
                      <Alert severity="error" id={'collat-ratio-slider-alert-text'}>
                        You will get liquidated.
                      </Alert>
                    </Collapse>
                    <Collapse in={collatPercent > 150 && collatPercent < 200}>
                      <Alert severity="warning" id={'collat-ratio-slider-alert-text'}>
                        Collateral ratio is too low. You will get liquidated at 150%.
                      </Alert>
                    </Collapse>

                    <Collapse in={collatPercent >= 200 && collatPercent < 225}>
                      <Alert severity="warning" id={'collat-ratio-slider-alert-text'}>
                        Collateral ratio is risky.
                      </Alert>
                    </Collapse>
                  </Box>
                </Box>
              </>
            )}

            <Box marginTop="24px">
              <InputToken
                id="close-short-trade-details"
                label="Spend"
                value={sellCloseQuote.amountIn.toFixed(6)}
                symbol="ETH"
                logo={ethLogo}
                balance={new BigNumber(balance)}
                usdPrice={ethPrice}
                showMaxAction={false}
                readOnly
              />
            </Box>

            <Collapse in={!!error}>
              <Alert severity="error" marginTop="24px">
                {error}
              </Alert>
            </Collapse>

            <Box
              display="flex"
              justifyContent="space-between"
              alignItems="center"
              gridGap="12px"
              marginTop="24px"
              flexWrap="wrap"
            >
              <Metric
                label="Collateral you redeem"
                value={formatNumber(withdrawCollat.isPositive() ? withdrawCollat.toNumber() : 0)}
                isSmall
              />
              <Metric label="Current collateral ratio" value={formatNumber(existingCollatPercent) + '%'} isSmall />
            </Box>

            <Box
              display="flex"
              alignItems="center"
              justifyContent="space-between"
              gridGap="12px"
              marginTop="12px"
              flexWrap="wrap"
            >
              <Metric
                label="Slippage"
                value={formatNumber(slippageAmountValue) + '%'}
                isSmall
                flexDirection="row"
                justifyContent="space-between"
                gridGap="12px"
              />
              <Box display="flex" alignItems="center" gridGap="12px" flex="1">
                <Metric
                  label="Price Impact"
                  value={formatNumber(priceImpact) + '%'}
                  textColor={priceImpactColor}
                  isSmall
                  flexDirection="row"
                  justifyContent="space-between"
                  gridGap="12px"
                />
                <TradeSettings setSlippage={(amt) => setSlippage(amt)} slippage={slippageAmount} />
              </Box>
            </Box>

            {isRestricted && <RestrictionInfo marginTop="24px" />}

            <Box marginTop="24px" className={classes.buttonDiv}>
              {isRestricted ? (
                <PrimaryButtonNew
                  fullWidth
                  variant="contained"
                  onClick={selectWallet}
                  disabled={true}
                  id="open-long-restricted-btn"
                >
                  {'Unavailable'}
                </PrimaryButtonNew>
              ) : !connected ? (
                <PrimaryButtonNew
                  fullWidth
                  variant="contained"
                  onClick={selectWallet}
                  className={classes.amountInput}
                  disabled={!!buyLoading}
                  id="close-short-connect-wallet-btn"
                >
                  {'Connect Wallet'}
                </PrimaryButtonNew>
              ) : (
                <PrimaryButtonNew
                  fullWidth
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
                    (vault && vault.shortAmount.isZero()) ||
                    !!vaultIdDontLoadedError ||
                    !!insufficientETHBalance
                  }
                  variant={shortClosePriceImpactErrorState ? 'outlined' : 'contained'}
                  style={
                    shortClosePriceImpactErrorState
                      ? { color: '#f5475c', backgroundColor: 'transparent', borderColor: '#f5475c' }
                      : {}
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
                </PrimaryButtonNew>
              )}
            </Box>
          </Box>
        </Box>
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

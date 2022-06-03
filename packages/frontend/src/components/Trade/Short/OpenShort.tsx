import {
  createStyles,
  makeStyles,
  Typography,
  InputAdornment,
  TextField,
  CircularProgress,
  Tooltip,
} from '@material-ui/core'
import { useAtom, useAtomValue } from 'jotai'
import { useState } from 'react'
import debounce from 'lodash.debounce'
import BigNumber from 'bignumber.js'
import ArrowRightAltIcon from '@material-ui/icons/ArrowRightAlt'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'
import { useResetAtom, useUpdateAtom } from 'jotai/utils'

import { TradeSettings } from '@components/TradeSettings'
import { PrimaryInput } from '@components/Input/PrimaryInput'
import {
  ethTradeAmountAtom,
  quoteAtom,
  slippageAmountAtom,
  sqthTradeAmountAtom,
  tradeCompletedAtom,
  tradeSuccessAtom,
} from 'src/state/trade/atoms'
import { Tooltips, Links } from '@constants/enums'
import CollatRange from '@components/CollatRange'
import { PrimaryButton } from '@components/Button'
import { useGetSellQuote } from 'src/state/squeethPool/hooks'
import { useFlashSwapAndMint } from 'src/state/controllerhelper/hooks'
import { useSelectWallet, useTransactionStatus, useWalletBalance } from 'src/state/wallet/hooks'
import { toTokenAmount } from '@utils/calculations'
import { BIG_ZERO, MIN_COLLATERAL_AMOUNT } from '@constants/index'
import { connectedWalletAtom, isTransactionFirstStepAtom, supportedNetworkAtom } from 'src/state/wallet/atoms'
import { addressesAtom, isLongAtom, vaultHistoryUpdatingAtom } from 'src/state/positions/atoms'
import { useComputeSwaps, useFirstValidVault } from 'src/state/positions/hooks'
import { useVaultData } from '@hooks/useVaultData'
import { useVaultManager } from '@hooks/contracts/useVaultManager'
import { useGetCollatRatioAndLiqPrice, useGetDebtAmount, useUpdateOperator } from 'src/state/controller/hooks'
import UniswapData from '../UniswapData'
import Confirmed, { ConfirmType } from '@components/Trade/Confirmed'
import Cancelled from '../Cancelled'
import useAppEffect from '@hooks/useAppEffect'
import useAppCallback from '@hooks/useAppCallback'
import useAppMemo from '@hooks/useAppMemo'
import { useVaultHistoryQuery } from '@hooks/useVaultHistory'
import { currentImpliedFundingAtom, dailyHistoricalFundingAtom } from 'src/state/controller/atoms'
import VaultCard from './VaultCard'
import ConfirmApproval from './ConfirmApproval'
import TradeDetails from '../TradeDetails'
import { useETHPrice } from '@hooks/useETHPrice'
import TradeInfoItem from '@components/Trade/TradeInfoItem'

const useStyles = makeStyles((theme) =>
  createStyles({
    buttonDiv: {
      position: 'sticky',
      bottom: '0',
      background: '#2A2D2E',
      paddingBottom: theme.spacing(3),
    },
    settingsButton: {
      marginTop: theme.spacing(2),
    },
    settingsContainer: {
      display: 'flex',
      justifyContent: 'space-between',
      width: '300px',
      margin: '0 auto',
    },
    explainer: {
      marginTop: theme.spacing(2),
      paddingRight: theme.spacing(1),
    },
    thirdHeading: {
      marginTop: theme.spacing(2),
    },
    formHelperText: {
      marginLeft: 0,
      marginRight: 0,
    },
    amountInput: {
      marginTop: theme.spacing(1),
      backgroundColor: `${theme.palette.error.main}aa`,
      '&:hover': {
        backgroundColor: theme.palette.error.dark,
      },
    },
    caption: {
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(1),
      fontSize: '13px',
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
    divider: {
      margin: theme.spacing(2, 0),
      width: '300px',
      marginLeft: 'auto',
      marginRight: 'auto',
    },
  }),
)

const FUNDING_MOVE_THRESHOLD = 0.7

export const OpenShortPosition = () => {
  const classes = useStyles()
  const [confirmedAmount, setConfirmedAmount] = useState('0')
  const [liqPrice, setLiqPrice] = useState(new BigNumber(0))
  const [shortLoading, setShortLoading] = useState(false)
  const [msgValue, setMsgValue] = useState(new BigNumber(0))
  const [totalCollateralAmount, setTotalCollateralAmount] = useState(new BigNumber(0))
  const [isVaultApproved, setIsVaultApproved] = useState(true)
  const [openConfirm, setOpenConfirm] = useState(false)
  const [CRError, setCRError] = useState('')
  const [minCR, setMinCR] = useState(BIG_ZERO)
  const [newCollat, setNewCollat] = useState(BIG_ZERO)
  const [existingLiqPrice, setExistingLiqPrice] = useState(BIG_ZERO)

  const [collatPercent, setCollatPercent] = useState(200)
  const [ethTradeAmount, setEthTradeAmount] = useAtom(ethTradeAmountAtom)
  const [sqthTradeAmount, setSqthTradeAmount] = useAtom(sqthTradeAmountAtom)
  const resetEthTradeAmount = useResetAtom(ethTradeAmountAtom)
  const [quote, setQuote] = useAtom(quoteAtom)
  const connected = useAtomValue(connectedWalletAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const isLong = useAtomValue(isLongAtom)
  const setTradeCompleted = useUpdateAtom(tradeCompletedAtom)
  const setTradeSuccess = useUpdateAtom(tradeSuccessAtom)
  const slippageAmount = useAtomValue(slippageAmountAtom)
  const { controllerHelper } = useAtomValue(addressesAtom)
  const currentImpliedFunding = useAtomValue(currentImpliedFundingAtom)
  const dailyHistoricalFunding = useAtomValue(dailyHistoricalFundingAtom)
  const [isTxFirstStep, setIsTxFirstStep] = useAtom(isTransactionFirstStepAtom)

  const { data } = useWalletBalance()
  const balance = Number(toTokenAmount(data ?? BIG_ZERO, 18).toFixed(4))
  const getSellQuote = useGetSellQuote()
  const flashSwapAndMint = useFlashSwapAndMint()
  const getDebtAmount = useGetDebtAmount()
  const { vaultId, validVault: vault } = useFirstValidVault()
  const { squeethAmount: shortSqueethAmount } = useComputeSwaps()
  const { cancelled, confirmed, failed, transactionData, resetTxCancelled, resetTransactionData } =
    useTransactionStatus()
  const [isVaultHistoryUpdating, setVaultHistoryUpdating] = useAtom(vaultHistoryUpdatingAtom)
  const { updateVault, loading: vaultIDLoading } = useVaultManager()
  const vaultHistoryQuery = useVaultHistoryQuery(Number(vaultId), isVaultHistoryUpdating)
  const { existingCollatPercent } = useVaultData(vault)
  const updateOperator = useUpdateOperator()
  const selectWallet = useSelectWallet()
  const getCollatRatioAndLiqPrice = useGetCollatRatioAndLiqPrice()
  const ethPrice = useETHPrice()

  const amount = useAppMemo(() => new BigNumber(sqthTradeAmount), [sqthTradeAmount])
  const collateral = useAppMemo(() => new BigNumber(ethTradeAmount), [ethTradeAmount])

  let inputError = ''
  let priceImpactWarning: string | undefined
  let vaultIdDontLoadedError: string | undefined
  let lowVolError: string | undefined

  if (connected) {
    if (new BigNumber(quote.priceImpact).gt(3)) {
      priceImpactWarning = 'High Price Impact'
    }
    if (collateral.isGreaterThan(new BigNumber(balance))) {
      inputError = 'Insufficient ETH balance'
    } else if (
      amount.isGreaterThan(0) &&
      newCollat.plus(vault?.collateralAmount || BIG_ZERO).lt(MIN_COLLATERAL_AMOUNT)
    ) {
      inputError = `Minimum collateral is ${MIN_COLLATERAL_AMOUNT} ETH`
    } else if (vault && vaultId === 0 && vault?.shortAmount.gt(0)) {
      vaultIdDontLoadedError = 'Loading Vault...'
    }
    if (currentImpliedFunding <= FUNDING_MOVE_THRESHOLD * dailyHistoricalFunding.funding && Number(amount) > 0) {
      const fundingPercent = (1 - currentImpliedFunding / dailyHistoricalFunding.funding) * 100
      lowVolError = `Funding is ${fundingPercent.toFixed(0)}% below yesterday. Consider buying later`
    }
    if (isLong) {
      inputError = 'Close your long position to open a short'
    }
  }

  const onSqthChange = useAppCallback(
    async (value: string) => {
      const [quote, debt, existingDebt] = await Promise.all([
        getSellQuote(new BigNumber(value), slippageAmount),
        getDebtAmount(new BigNumber(value)),
        getDebtAmount(new BigNumber(vault?.shortAmount ?? BIG_ZERO)),
      ])
      setQuote(quote)
      const totalDebt = existingDebt.plus(debt)
      setMinCR(
        BigNumber.max(
          (vault?.collateralAmount ?? BIG_ZERO).plus(quote.amountOut).dividedBy(totalDebt) ?? BIG_ZERO,
          1.5,
        ),
      )

      const newCollat = new BigNumber(collatPercent / 100).multipliedBy(totalDebt).minus(vault?.collateralAmount ?? 0)
      setNewCollat(newCollat)
      setEthTradeAmount(newCollat.minus(quote.minimumAmountOut).toFixed(6))

      if (newCollat.gt(quote.minimumAmountOut)) {
        setMsgValue(newCollat.minus(quote.minimumAmountOut))
      } else if (newCollat.lt(0)) {
        setCRError('This CR is Invalid')
        return
      } else if (newCollat.lt(quote.amountOut)) {
        setMsgValue(new BigNumber(0))
      }

      setTotalCollateralAmount(quote.amountOut.plus(newCollat.minus(quote.minimumAmountOut)))

      getCollatRatioAndLiqPrice(debt.times(new BigNumber(collatPercent / 100)), new BigNumber(value)).then(
        ({ liquidationPrice }) => {
          setLiqPrice(liquidationPrice)
        },
      )
    },
    [
      collatPercent,
      getCollatRatioAndLiqPrice,
      getDebtAmount,
      getSellQuote,
      setEthTradeAmount,
      setQuote,
      slippageAmount,
      vault?.collateralAmount,
      vault?.shortAmount,
    ],
  )
  const handleSqthChange = useAppMemo(() => debounce(onSqthChange, 500), [onSqthChange])

  useAppEffect(() => {
    if (!vault || vaultId === 0) return

    getCollatRatioAndLiqPrice(vault?.collateralAmount, new BigNumber(vault?.shortAmount)).then(
      ({ liquidationPrice }) => {
        setExistingLiqPrice(liquidationPrice)
      },
    )
  }, [getCollatRatioAndLiqPrice, vault, vaultId])

  useAppEffect(() => {
    //stop loading if transaction failed
    if (failed) setShortLoading(false)
  }, [failed])

  useAppEffect(() => {
    if (!vaultId || !vault) return

    setIsVaultApproved(vault?.operator?.toLowerCase() === controllerHelper?.toLowerCase())
  }, [controllerHelper, vault, vaultId])

  const handleConfirmApproval = async () => {
    try {
      setShortLoading(true)
      setIsTxFirstStep(true)
      setOpenConfirm(false)
      await updateOperator(Number(vaultId), controllerHelper, () => {
        setIsVaultApproved(true)
        setShortLoading(false)
      })
    } catch (error) {
      setShortLoading(false)
    }
  }

  const handleCollatRatioChange = (value: string) => {
    if (new BigNumber(Number(value) / 100).lt(minCR ?? BIG_ZERO)) {
      setCRError(`Minimum CR is ${minCR.times(100).toFixed(1)}%`)
      return
    }
    setCRError('')
    setCollatPercent(Number(value))
  }

  const handleSubmit = useAppCallback(async () => {
    try {
      if (vaultIDLoading) {
        setShortLoading(false)
        return
      }
      if (!isVaultApproved) {
        setOpenConfirm(true)
      } else {
        setShortLoading(true)
        await flashSwapAndMint(Number(vaultId), totalCollateralAmount, amount, quote.amountOut, msgValue, () => {
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
    flashSwapAndMint,
    isVaultApproved,
    msgValue,
    quote.amountOut,
    resetEthTradeAmount,
    setIsTxFirstStep,
    setTradeCompleted,
    setTradeSuccess,
    setVaultHistoryUpdating,
    totalCollateralAmount,
    updateVault,
    vaultHistoryQuery,
    vaultIDLoading,
    vaultId,
  ])

  useAppEffect(() => {
    onSqthChange(sqthTradeAmount)
  }, [onSqthChange, sqthTradeAmount, collatPercent])

  const shortOpenPriceImpactErrorState = priceImpactWarning && !shortLoading && !(collatPercent < 150) && !inputError

  return (
    <>
      <ConfirmApproval
        openConfirm={openConfirm}
        title="Approve New Wrapper"
        handleClose={() => setOpenConfirm((prevState) => !prevState)}
        handleConfirmApproval={handleConfirmApproval}
      />
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
        <>
          <div className={classes.settingsContainer}>
            <Typography variant="caption" className={classes.explainer} id="open-short-header-box" component="div">
              Short Squeeth to earn funding.
            </Typography>
            <span className={classes.settingsButton}>
              <TradeSettings />
            </span>
          </div>
          <form>
            <PrimaryInput
              name="sqth"
              id="open-short-sqth-input"
              value={sqthTradeAmount}
              onChange={(val) => {
                setSqthTradeAmount(val)
                handleSqthChange(val)
              }}
              label="Sell"
              unit="oSQTH"
              tooltip={Tooltips.SellOpenAmount}
              hint={
                inputError ? (
                  <span style={{ color: '#f5475c' }}>{inputError}</span>
                ) : (
                  <div className={classes.hint}>
                    <span className={classes.hintTextContainer}>
                      <span className={classes.hintTitleText}>Position</span>
                      <span id="open-short-osqth-before-trade-balance">{shortSqueethAmount.toFixed(4)}</span>
                    </span>
                    {quote.amountOut.gt(0) ? (
                      <>
                        <ArrowRightAltIcon className={classes.arrowIcon} />
                        <span id="open-short-osqth-post-trade-balance">
                          {shortSqueethAmount.plus(amount).toFixed(4)}
                        </span>
                      </>
                    ) : null}{' '}
                    <span style={{ marginLeft: '4px' }}>oSQTH</span>
                  </div>
                )
              }
              // id="open-short-trade-details"
            />
            <div className={classes.thirdHeading}>
              <TextField
                size="small"
                value={collatPercent}
                type="number"
                style={{ width: 300 }}
                onChange={(event) => {
                  handleCollatRatioChange(event.target.value)
                }}
                id="filled-basic"
                label="Collateral ratio for vault"
                variant="outlined"
                error={collatPercent < 150 || CRError !== ''}
                helperText={CRError !== '' ? CRError : 'At risk of liquidation at 150%'}
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
            <CollatRange
              onCollatValueChange={(val) => {
                handleCollatRatioChange(String(val))
              }}
              collatValue={collatPercent}
            />
            <VaultCard
              liqPrice={{
                existing: existingLiqPrice.gt(0) ? existingLiqPrice.toFixed(2) : 0,
                after: liqPrice.toFixed(2),
              }}
              collatRatio={{ existing: existingCollatPercent, after: collatPercent }}
              vaultCollat={{
                existing: vault?.collateralAmount.toFixed(2) ?? '0',
                after: vault?.collateralAmount
                  ? vault?.collateralAmount.plus(newCollat).toFixed(2)
                  : newCollat.toFixed(2),
              }}
              vaultId={vaultId}
            />
            <TradeDetails
              actionTitle="Collateral to deposit"
              amount={ethTradeAmount}
              unit="ETH"
              value={!collateral.isNaN() ? collateral.times(ethPrice).toFixed(2).toLocaleString() : '0'}
              hint={
                inputError ? (
                  inputError
                ) : priceImpactWarning ? (
                  priceImpactWarning
                ) : lowVolError ? (
                  lowVolError
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
                        </span>
                      </>
                    ) : null}
                    <span style={{ marginLeft: '4px' }}>ETH</span>
                  </div>
                )
              }
              id="open-short-eth-input"
            />

            <div className={classes.divider}>
              <TradeInfoItem
                label="Collateral from sale"
                value={quote.minimumAmountOut.toFixed(2)}
                unit="ETH"
                tooltip={Tooltips.SaleProceeds}
                id="open-short-liquidation-price"
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
            {!connected ? (
              <PrimaryButton
                variant="contained"
                onClick={selectWallet}
                className={classes.amountInput}
                style={{ width: '300px' }}
                id="open-short-connect-wallet-btn"
              >
                Connect Wallet
              </PrimaryButton>
            ) : (
              <PrimaryButton
                onClick={handleSubmit}
                className={classes.amountInput}
                disabled={
                  !supportedNetwork ||
                  shortLoading ||
                  Boolean(inputError) ||
                  Boolean(vaultIdDontLoadedError) ||
                  amount.isZero() ||
                  collateral.isZero() ||
                  collatPercent < 150 ||
                  (vault && vault.shortAmount.isZero())
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
                ) : shortLoading ? (
                  <CircularProgress color="primary" size="1.5rem" />
                ) : (
                  <>
                    {isVaultApproved
                      ? 'Open Short'
                      : shortOpenPriceImpactErrorState && isVaultApproved
                      ? 'Open Short anyway'
                      : 'Approve Squeethy 1 Click Wrapper'}
                    {!isVaultApproved ? (
                      <Tooltip style={{ marginLeft: '2px' }} title={Tooltips.ControllerHelperOperator}>
                        <InfoOutlinedIcon fontSize="small" />
                      </Tooltip>
                    ) : null}
                  </>
                )}
              </PrimaryButton>
            )}
          </form>
          <Typography variant="caption" className={classes.caption} component="div">
            <a href={Links.UniswapSwap} target="_blank" rel="noreferrer">
              {' '}
              Trades on Uniswap V3 🦄{' '}
            </a>
          </Typography>
        </>
      )}
    </>
  )
}

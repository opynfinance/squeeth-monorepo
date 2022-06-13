import {
  createStyles,
  makeStyles,
  Typography,
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  CircularProgress,
  Tooltip,
} from '@material-ui/core'
import { useEffect, useMemo, useState } from 'react'
import { useAtom, useAtomValue } from 'jotai'
import BigNumber from 'bignumber.js'
import debounce from 'lodash.debounce'
import ArrowRightAltIcon from '@material-ui/icons/ArrowRightAlt'
import InfoOutlinedIcon from '@material-ui/icons/InfoOutlined'

import { TradeSettings } from '@components/TradeSettings'
import { PrimaryInput } from '@components/Input/PrimaryInput'
import { PrimaryButton } from '@components/Button'
import { Tooltips, CloseType, Links } from '@constants/enums'
import CollatRange from '@components/CollatRange'
import TradeInfoItem from '@components/Trade/TradeInfoItem'
import UniswapData from '@components/Trade/UniswapData'
import {
  sellCloseQuoteAtom,
  slippageAmountAtom,
  sqthTradeAmountAtom,
  tradeCompletedAtom,
  tradeSuccessAtom,
} from 'src/state/trade/atoms'
import useAppCallback from '@hooks/useAppCallback'
import { MIN_COLLATERAL_AMOUNT, BIG_ZERO } from '@constants/index'
import { connectedWalletAtom, isTransactionFirstStepAtom, supportedNetworkAtom } from 'src/state/wallet/atoms'
import { useSelectWallet, useTransactionStatus, useWalletBalance } from 'src/state/wallet/hooks'
import { toTokenAmount } from '@utils/calculations'
import { addressesAtom, isLongAtom, vaultHistoryUpdatingAtom } from 'src/state/positions/atoms'
import { useFirstValidVault } from 'src/state/positions/hooks'
import { useVaultManager } from '@hooks/contracts/useVaultManager'
import { useGetCollatRatioAndLiqPrice, useGetDebtAmount, useUpdateOperator } from 'src/state/controller/hooks'
import { useGetBuyQuote, useGetWSqueethPositionValue } from 'src/state/squeethPool/hooks'
import { useFlashSwapAndBurn } from 'src/state/controllerhelper/hooks'
import { useVaultData } from '@hooks/useVaultData'
import { useETHPrice } from '@hooks/useETHPrice'
import TradeDetails from '../TradeDetails'
import { useResetAtom, useUpdateAtom } from 'jotai/utils'
import Confirmed, { ConfirmType } from '../Confirmed'
import Cancelled from '../Cancelled'
import useAppEffect from '@hooks/useAppEffect'
import { useVaultHistoryQuery } from '@hooks/useVaultHistory'
import useAppMemo from '@hooks/useAppMemo'
import VaultCard from './VaultCard'
import ConfirmApproval from './ConfirmApproval'

const useStyles = makeStyles((theme) =>
  createStyles({
    settingsContainer: {
      display: 'flex',
      justifyContent: 'space-between',
      textAlign: 'left',
      margin: '0 auto',
      width: '300px',
    },
    settingsButton: {
      marginTop: theme.spacing(2),
      marginLeft: theme.spacing(10),
      justifyContent: 'right',
    },
    explainer: {
      marginTop: theme.spacing(2),
      paddingRight: theme.spacing(1),
      width: '200px',
      justifyContent: 'left',
    },
    thirdHeading: {
      marginTop: theme.spacing(2),
    },
    formHelperText: {
      marginLeft: 0,
      marginRight: 0,
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
    buttonDiv: {
      position: 'sticky',
      bottom: '0',
      background: '#2A2D2E',
      paddingBottom: theme.spacing(1),
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
    divider: {
      margin: theme.spacing(2, 0),
      width: '300px',
      marginLeft: 'auto',
      marginRight: 'auto',
    },
  }),
)

export const CloseShort = () => {
  const classes = useStyles()
  const [collatPercent, setCollatPercent] = useState(200)
  const [closeType, setCloseType] = useState(CloseType.FULL)
  const [closeLoading, setCloseLoading] = useState(false)
  const [withdrawCollat, setWithdrawCollat] = useState(new BigNumber(0))
  const [isVaultApproved, setIsVaultApproved] = useState(true)
  const [confirmedAmount, setConfirmedAmount] = useState('')
  const [liqPrice, setLiqPrice] = useState(BIG_ZERO)
  const [newCollat, setNewCollat] = useState(BIG_ZERO)
  const [openConfirm, setOpenConfirm] = useState(false)

  const [sqthTradeAmount, setSqthTradeAmount] = useAtom(sqthTradeAmountAtom)
  const [isVaultHistoryUpdating, setVaultHistoryUpdating] = useAtom(vaultHistoryUpdatingAtom)
  const [isTxFirstStep, setIsTxFirstStep] = useAtom(isTransactionFirstStepAtom)
  const { controllerHelper } = useAtomValue(addressesAtom)
  const slippageAmount = useAtomValue(slippageAmountAtom)
  const amount = useAppMemo(() => new BigNumber(sqthTradeAmount), [sqthTradeAmount])
  const connected = useAtomValue(connectedWalletAtom)
  const isLong = useAtomValue(isLongAtom)
  const supportedNetwork = useAtomValue(supportedNetworkAtom)
  const { updateVault } = useVaultManager()
  const [sellCloseQuote, setSellCloseQuote] = useAtom(sellCloseQuoteAtom)
  const resetSqthTradeAmount = useResetAtom(sqthTradeAmountAtom)
  const setTradeCompleted = useUpdateAtom(tradeCompletedAtom)
  const setTradeSuccess = useUpdateAtom(tradeSuccessAtom)

  const { cancelled, confirmed, transactionData, resetTransactionData, resetTxCancelled } = useTransactionStatus()
  const updateOperator = useUpdateOperator()
  const { validVault: vault, vaultId } = useFirstValidVault()
  const { existingCollatPercent, existingLiqPrice } = useVaultData(vault)
  const vaultHistoryQuery = useVaultHistoryQuery(Number(vaultId), isVaultHistoryUpdating)

  const { data } = useWalletBalance()
  const balance = Number(toTokenAmount(data ?? BIG_ZERO, 18).toFixed(4))
  const getDebtAmount = useGetDebtAmount()
  const getBuyQuote = useGetBuyQuote()
  const flashSwapAndBurn = useFlashSwapAndBurn()
  const selectWallet = useSelectWallet()
  const ethPrice = useETHPrice()
  const getWSqueethPositionValue = useGetWSqueethPositionValue()
  const getCollatRatioAndLiqPrice = useGetCollatRatioAndLiqPrice()

  let closeError: string | undefined
  let existingLongError: string | undefined
  let priceImpactWarning: string | undefined
  let vaultIdDontLoadedError: string | undefined
  let insufficientETHBalance: string | undefined

  useEffect(() => {
    if (!vaultId || !vault) return

    setIsVaultApproved(vault.operator?.toLowerCase() === controllerHelper?.toLowerCase())
  }, [controllerHelper, vault, vaultId])

  if (connected) {
    if (
      (vault?.shortAmount && vault?.shortAmount.lt(0) && vault?.shortAmount.lt(amount)) ||
      (vault?.shortAmount && amount.gt(vault.shortAmount))
    ) {
      closeError = 'Close amount exceeds position'
    }
    if (new BigNumber(sellCloseQuote.priceImpact).gt(3)) {
      priceImpactWarning = 'High Price Impact'
    }
    if (vaultId === 0 && vault?.shortAmount.gt(0)) {
      vaultIdDontLoadedError = 'Loading Vault...'
    }
    if (
      amount.isGreaterThan(0) &&
      vault &&
      vault?.shortAmount &&
      amount.lt(vault?.shortAmount) &&
      newCollat.isLessThan(MIN_COLLATERAL_AMOUNT)
    ) {
      closeError = `You must have at least ${MIN_COLLATERAL_AMOUNT} ETH collateral unless you fully close out your position. Either fully close your position, or close out less`
    }
    if (isLong && !vault?.shortAmount.isGreaterThan(0)) {
      existingLongError = 'Close your long position to open a short'
    }
    if (sellCloseQuote.amountIn.gt(balance)) {
      insufficientETHBalance = 'Insufficient ETH Balance'
    }
  }

  const shortClosePriceImpactErrorState =
    priceImpactWarning &&
    !closeLoading &&
    !(collatPercent < 150) &&
    !closeError &&
    !existingLongError &&
    vault &&
    !vault.shortAmount.isZero()

  useAppEffect(() => {
    if (vault?.shortAmount && vault?.shortAmount.isGreaterThan(0)) {
      setSqthTradeAmount(vault?.shortAmount.toString())
      getBuyQuote(vault?.shortAmount, slippageAmount).then((quote: any) => {
        setSellCloseQuote(quote)
      })
      setCollatPercent(150)
      setCloseType(CloseType.FULL)
    }
  }, [vault?.shortAmount, getBuyQuote, setSellCloseQuote, setSqthTradeAmount, slippageAmount])

  const onSqthChange = useAppCallback(
    async (v: string) => {
      if (new BigNumber(v).lte(0)) return setNewCollat(BIG_ZERO)

      const [quote, debt] = await Promise.all([
        getBuyQuote(new BigNumber(v), slippageAmount),
        getDebtAmount(vault?.shortAmount.minus(new BigNumber(v)) ?? BIG_ZERO),
      ])
      const _collat = vault?.collateralAmount ?? BIG_ZERO
      const newCollat = new BigNumber(collatPercent / 100).multipliedBy(debt)
      setSellCloseQuote(quote)
      getCollatRatioAndLiqPrice(newCollat, vault?.shortAmount.minus(new BigNumber(v)) ?? BIG_ZERO).then(
        ({ liquidationPrice }) => {
          setLiqPrice(liquidationPrice)
        },
      )
      setWithdrawCollat(newCollat.gt(0) ? _collat.minus(newCollat) : _collat)
      setNewCollat(newCollat)
    },
    [
      collatPercent,
      getBuyQuote,
      getCollatRatioAndLiqPrice,
      getDebtAmount,
      setSellCloseQuote,
      slippageAmount,
      vault?.collateralAmount,
      vault?.shortAmount,
    ],
  )
  const handleSqthChange = useMemo(() => debounce(onSqthChange, 500), [onSqthChange])

  useAppEffect(() => {
    if (amount.lte(0)) {
      setSellCloseQuote({
        amountIn: BIG_ZERO,
        maximumAmountIn: BIG_ZERO,
        priceImpact: '0',
      })
    }
  }, [amount, setSellCloseQuote])

  const handleConfirmApproval = async () => {
    try {
      setCloseLoading(true)
      setIsTxFirstStep(true)
      setOpenConfirm(false)
      await updateOperator(Number(vaultId), controllerHelper, () => {
        setIsVaultApproved(true)
        setCloseLoading(false)
      })
    } catch (error) {
      setCloseLoading(false)
    }
  }

  const handleCloseShort = async () => {
    try {
      if (vaultId && !isVaultApproved) {
        setOpenConfirm(true)
        return
      } else {
        setCloseLoading(true)
        await flashSwapAndBurn(
          vaultId,
          amount,
          withdrawCollat,
          sellCloseQuote.maximumAmountIn,
          sellCloseQuote.amountIn.gt(withdrawCollat) ? sellCloseQuote.amountIn.minus(withdrawCollat) : BIG_ZERO,
          async () => {
            setIsTxFirstStep(false)
            setCloseLoading(false)
            setConfirmedAmount(amount.toFixed(6).toString())
            setTradeSuccess(true)
            setTradeCompleted(true)
            resetSqthTradeAmount()
            setIsVaultApproved(false)
            setVaultHistoryUpdating(true)
            updateVault()
            vaultHistoryQuery.refetch({ vaultId })
            setCloseLoading(false)
          },
        )
      }
    } catch (e) {
      console.log(e)
      setCloseLoading(false)
    }
  }

  const setShortCloseMax = useAppCallback(() => {
    if (vault?.shortAmount && vault?.shortAmount.isGreaterThan(0)) {
      setSqthTradeAmount(vault?.shortAmount.toString())
      onSqthChange(vault?.shortAmount.toString())
      setCollatPercent(150)
      setCloseType(CloseType.FULL)
    }
  }, [vault?.shortAmount, onSqthChange, setSqthTradeAmount])

  useAppEffect(() => {
    onSqthChange(sqthTradeAmount)
  }, [onSqthChange, sqthTradeAmount, collatPercent])

  return (
    <div id="close-short-card">
      <ConfirmApproval
        openConfirm={openConfirm}
        title="Approve New Wrapper"
        handleClose={() => setOpenConfirm((prevState) => !prevState)}
        handleConfirmApproval={handleConfirmApproval}
      />
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
                setCloseLoading(false)
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
        <div style={{ width: '90%', margin: '0 auto', minWidth: '300px' }}>
          <div className={classes.settingsContainer}>
            <Typography variant="caption" className={classes.explainer} component="div" id="close-short-header-box">
              Buy back oSQTH and close position using vault collateral
            </Typography>
            <span className={classes.settingsButton}>
              <TradeSettings />
            </span>
          </div>
          <form>
            <div className={classes.thirdHeading}>
              <PrimaryInput
                isFullClose={closeType === CloseType.FULL}
                value={sqthTradeAmount}
                onChange={(val) => {
                  setSqthTradeAmount(val)
                  handleSqthChange(val)
                }}
                label="Amount"
                tooltip={Tooltips.SellCloseAmount}
                onActionClicked={setShortCloseMax}
                actionTxt="Max"
                unit="oSQTH"
                convertedValue={
                  !amount.isNaN()
                    ? getWSqueethPositionValue(amount).toFixed(2).toLocaleString()
                    : Number(0).toLocaleString()
                }
                error={!!existingLongError || !!priceImpactWarning || !!closeError || !!insufficientETHBalance}
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
                        <span id="close-short-osqth-before-trade-balance">
                          {(vault?.shortAmount ?? BIG_ZERO).toFixed(6)}
                        </span>
                      </span>
                      {amount.toNumber() ? (
                        <>
                          <ArrowRightAltIcon className={classes.arrowIcon} />
                          <span id="close-short-osqth-post-trade-balance">
                            {(vault?.shortAmount.minus(amount) ?? BIG_ZERO).toFixed(6)}
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

            <div style={{ width: '100%', maxWidth: '300px', margin: '0 auto' }}>
              <Select
                label="Type of Close"
                value={closeType}
                onChange={(event: React.ChangeEvent<{ value: unknown }>) => {
                  if (event.target.value === CloseType.FULL) {
                    setShortCloseMax()
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
                <MenuItem id="close-short-partial-close" value={CloseType.PARTIAL}>
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
                  id="close-short-collat-ratio-input"
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
                <VaultCard
                  liqPrice={{
                    existing: existingLiqPrice.gt(0) ? existingLiqPrice.toFixed(2) : 0,
                    after: liqPrice.toFixed(2),
                  }}
                  collatRatio={{ existing: existingCollatPercent, after: collatPercent }}
                  vaultCollat={{
                    existing: vault?.collateralAmount.toFixed(2) ?? '0',
                    after: newCollat.toFixed(2),
                  }}
                  error={{
                    vaultCollat: closeError && closeError !== '' ? closeError : '',
                  }}
                  vaultId={vaultId}
                  id="close-short-vault-card"
                />
              </div>
            )}

            <div className={classes.thirdHeading}>
              <TradeDetails
                actionTitle="Spend"
                amount={sellCloseQuote.amountIn.toFixed(6)}
                unit="ETH"
                value={Number(ethPrice.times(sellCloseQuote.amountIn).toFixed(2)).toLocaleString()}
                hint={
                  connected && vault && vault.shortAmount.gt(0) ? (
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
                id="close-short-trade-details"
              />
            </div>
            <div className={classes.divider}>
              <TradeInfoItem
                label="Collateral you redeem"
                value={
                  closeType === CloseType.FULL
                    ? (vault?.collateralAmount ?? BIG_ZERO).toFixed(4)
                    : withdrawCollat.isPositive()
                    ? withdrawCollat.toFixed(4)
                    : 0
                }
                unit="ETH"
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
                  disabled={!!closeLoading}
                  style={{ width: '300px' }}
                >
                  {'Connect Wallet'}
                </PrimaryButton>
              ) : (
                <PrimaryButton
                  variant={shortClosePriceImpactErrorState ? 'outlined' : 'contained'}
                  onClick={handleCloseShort}
                  className={classes.amountInput}
                  disabled={
                    !supportedNetwork ||
                    sqthTradeAmount === '0' ||
                    closeLoading ||
                    collatPercent < 150 ||
                    !!closeError ||
                    !!existingLongError ||
                    (vault && vault.shortAmount.isZero()) ||
                    !!vaultIdDontLoadedError ||
                    !!insufficientETHBalance
                  }
                  style={
                    shortClosePriceImpactErrorState
                      ? { width: '300px', color: '#f5475c', backgroundColor: 'transparent', borderColor: '#f5475c' }
                      : { width: '300px' }
                  }
                  id="close-short-submit-tx-btn"
                >
                  {!supportedNetwork ? (
                    'Unsupported Network'
                  ) : closeLoading ? (
                    <CircularProgress color="primary" size="1.5rem" />
                  ) : (
                    <>
                      {isVaultApproved
                        ? 'Close Short'
                        : shortClosePriceImpactErrorState && isVaultApproved
                        ? 'Close Short anyway'
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
          </form>
        </div>
      )}
    </div>
  )
}

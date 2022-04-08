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
  ethTradeAmountAtom,
  quoteAtom,
  sellCloseQuoteAtom,
  slippageAmountAtom,
  sqthTradeAmountAtom,
  tradeCompletedAtom,
  tradeSuccessAtom,
  tradeTypeAtom,
} from 'src/state/trade/atoms'
import useAppCallback from '@hooks/useAppCallback'
import { MIN_COLLATERAL_AMOUNT, BIG_ZERO } from '@constants/index'
import { connectedWalletAtom, isTransactionFirstStepAtom } from 'src/state/wallet/atoms'
import { useSelectWallet, useTransactionStatus, useWalletBalance } from 'src/state/wallet/hooks'
import { toTokenAmount } from '@utils/calculations'
import { addressesAtom, isLongAtom } from 'src/state/positions/atoms'
import { useFirstValidVault, useVaultQuery } from 'src/state/positions/hooks'
import { useVaultManager } from '@hooks/contracts/useVaultManager'
import { useGetDebtAmount, useUpdateOperator } from 'src/state/controller/hooks'
import { useGetBuyQuote } from 'src/state/squeethPool/hooks'
import { useFlashSwapAndBurn } from 'src/state/controllerhelper/hooks'
import { useVaultData } from '@hooks/useVaultData'
import { useETHPrice } from '@hooks/useETHPrice'
import TradeDetails from '../TradeDetails'
import { useResetAtom, useUpdateAtom } from 'jotai/utils'
import Confirmed, { ConfirmType } from '../Confirmed'
import Cancelled from '../Cancelled'
import useAppEffect from '@hooks/useAppEffect'

const useStyles = makeStyles((theme) =>
  createStyles({
    settingsContainer: {
      display: 'flex',
      justify: 'space-between',
    },
    settingsButton: {
      marginTop: theme.spacing(2),
      marginLeft: theme.spacing(10),
      justifyContent: 'right',
    },
    explainer: {
      marginTop: theme.spacing(2),
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
      marginLeft: theme.spacing(1),
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

const errorMap = {
  closeError: 'Close amount exceeds position',
  closeAltError: `You must have at least ${MIN_COLLATERAL_AMOUNT} ETH collateral unless you fully close out your position. Either fully close your position, or close out less`,
  priceImpactWarning: 'High Price Impact',
  openError: `Minimum collateral is ${MIN_COLLATERAL_AMOUNT} ETH`,
  existingLongError: 'Close your long position to open a short',
  vaultNotLoadedError: 'Loading Vault...',
  insufficientETHBalance: 'Insufficient ETH Balance',
}
type formError = keyof typeof errorMap | false

export const CloseShort = () => {
  const classes = useStyles()
  const [collatPercent, setCollatPercent] = useState(200)
  const [closeType, setCloseType] = useState(CloseType.FULL)
  const [closeLoading, setCloseLoading] = useState(false)
  const [finalShortAmount, setFinalShortAmount] = useState(new BigNumber(0))
  const [neededCollat, setNeededCollat] = useState(new BigNumber(0))
  const [withdrawCollat, setWithdrawCollat] = useState(new BigNumber(0))
  const [isVaultApproved, setIsVaultApproved] = useState(true)
  const [confirmedAmount, setConfirmedAmount] = useState('')
  const [sqthTradeAmount, setSqthTradeAmount] = useAtom(sqthTradeAmountAtom)
  const [isTxFirstStep, setIsTxFirstStep] = useAtom(isTransactionFirstStepAtom)
  const { controllerHelper } = useAtomValue(addressesAtom)
  const slippageAmount = useAtomValue(slippageAmountAtom)
  const amount = new BigNumber(sqthTradeAmount)
  const connected = useAtomValue(connectedWalletAtom)
  const isLong = useAtomValue(isLongAtom)
  const tradeType = useAtomValue(tradeTypeAtom)
  const [sellCloseQuote, setSellCloseQuote] = useAtom(sellCloseQuoteAtom)
  const resetSqthTradeAmount = useResetAtom(sqthTradeAmountAtom)
  const setTradeCompleted = useUpdateAtom(tradeCompletedAtom)
  const setTradeSuccess = useUpdateAtom(tradeSuccessAtom)

  const { cancelled, confirmed, transactionData, resetTransactionData, resetTxCancelled } = useTransactionStatus()
  const updateOperator = useUpdateOperator()
  const { vaults: shortVaults } = useVaultManager()
  const { vaultId, firstValidVault } = useFirstValidVault()
  const { existingCollatPercent } = useVaultData(vaultId)
  const vaultQuery = useVaultQuery(vaultId)
  const vault = vaultQuery.data
  const { data } = useWalletBalance()
  const balance = Number(toTokenAmount(data ?? BIG_ZERO, 18).toFixed(4))
  const getDebtAmount = useGetDebtAmount()
  const getBuyQuote = useGetBuyQuote()
  const flashSwapAndBurn = useFlashSwapAndBurn()
  const selectWallet = useSelectWallet()
  const ethPrice = useETHPrice()

  const setShortCloseMax = useAppCallback(() => {
    if (finalShortAmount.isGreaterThan(0)) {
      setSqthTradeAmount(finalShortAmount.toString())
      setCollatPercent(150)
      setCloseType(CloseType.FULL)
    }
  }, [finalShortAmount])

  useEffect(() => {
    if (vault) {
      const contractShort = vault?.shortAmount?.isFinite() ? vault?.shortAmount : new BigNumber(0)
      setFinalShortAmount(contractShort)
    }
  }, [vault?.shortAmount.toString()])

  useEffect(() => {
    if (shortVaults.length) {
      const _collat: BigNumber = vault?.collateralAmount ?? new BigNumber(0)
      const restOfShort = new BigNumber(vault?.shortAmount ?? new BigNumber(0)).minus(amount)

      getDebtAmount(new BigNumber(restOfShort)).then((debt) => {
        const _neededCollat = debt.times(collatPercent / 100)
        setNeededCollat(_neededCollat)
        setWithdrawCollat(_neededCollat.gt(0) ? _collat.minus(neededCollat) : _collat)
      })
    }
  }, [
    amount.toString(),
    shortVaults?.length,
    collatPercent,
    vault?.collateralAmount.toString(),
    vault?.shortAmount.toString(),
  ])

  let closeError: string | undefined
  let existingLongError: string | undefined
  let priceImpactWarning: string | undefined
  let vaultIdDontLoadedError: string | undefined
  let insufficientETHBalance: string | undefined

  useEffect(() => {
    if (!vaultId) return

    setIsVaultApproved(shortVaults[firstValidVault].operator?.toLowerCase() === controllerHelper?.toLowerCase())
  }, [vaultId])

  if (connected) {
    if (finalShortAmount.lt(0) && finalShortAmount.lt(amount)) {
      closeError = 'Close amount exceeds position'
    }
    if (new BigNumber(sellCloseQuote.priceImpact).gt(3)) {
      priceImpactWarning = 'High Price Impact'
    }
    if (vaultId === 0 && finalShortAmount.gt(0)) {
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
    !closeLoading &&
    !(collatPercent < 150) &&
    !closeError &&
    !existingLongError &&
    shortVaults.length &&
    !shortVaults[firstValidVault].shortAmount.isZero()

  useAppEffect(() => {
    if (finalShortAmount.isGreaterThan(0)) {
      setSqthTradeAmount(finalShortAmount.toString())
      getBuyQuote(finalShortAmount, slippageAmount).then((quote: any) => {
        setSellCloseQuote(quote)
      })
      setCollatPercent(150)
      setCloseType(CloseType.FULL)
    }
  }, [tradeType, open, finalShortAmount])

  const onSqthChange = (v: string) => {
    getBuyQuote(new BigNumber(v), slippageAmount).then((quote: any) => {
      setSellCloseQuote(quote)
    })
  }
  const handleSqthChange = useMemo(() => debounce(onSqthChange, 500), [getBuyQuote, slippageAmount])

  const handleCloseShort = async () => {
    setCloseLoading(true)
    try {
      if (vaultId && !isVaultApproved) {
        setIsTxFirstStep(true)
        await updateOperator(vaultId, controllerHelper, () => {
          setIsVaultApproved(true)
          setCloseLoading(false)
        })
      } else {
        await flashSwapAndBurn(
          vaultId,
          amount,
          withdrawCollat,
          sellCloseQuote.maximumAmountIn,
          sellCloseQuote.maximumAmountIn.gt(withdrawCollat)
            ? sellCloseQuote.maximumAmountIn.minus(withdrawCollat)
            : BIG_ZERO,
          async () => {
            setIsTxFirstStep(false)
            setConfirmedAmount(amount.toFixed(6).toString())
            setTradeSuccess(true)
            setTradeCompleted(true)
            resetSqthTradeAmount()
            setIsVaultApproved(false)
            vaultQuery.refetch({ vaultID: vault!.id })
          },
        )
      }
    } catch (e) {
      console.log(e)
      setCloseLoading(false)
    }
  }

  return (
    <>
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
            <Typography variant="caption" className={classes.explainer} component="div">
              Burn oSQTH & close position
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
                        <span>{finalShortAmount.toFixed(6)}</span>
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
                  setCollatPercent(200)
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

            <div className={classes.thirdHeading}>
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
            </div>
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
                    sqthTradeAmount === '0' ||
                    closeLoading ||
                    collatPercent < 150 ||
                    !!closeError ||
                    !!existingLongError ||
                    (shortVaults.length && shortVaults[firstValidVault].shortAmount.isZero()) ||
                    !!vaultIdDontLoadedError ||
                    !!insufficientETHBalance
                  }
                  style={
                    shortClosePriceImpactErrorState
                      ? { width: '300px', color: '#f5475c', backgroundColor: 'transparent', borderColor: '#f5475c' }
                      : { width: '300px' }
                  }
                >
                  {closeLoading ? (
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
    </>
  )
}

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
import { useGetSellQuote, useExactOutSellQuote } from 'src/state/squeethPool/hooks'
import { useFlashSwapAndMint } from 'src/state/controllerhelper/hooks'
import { useSelectWallet, useTransactionStatus, useWalletBalance } from 'src/state/wallet/hooks'
import { toTokenAmount } from '@utils/calculations'
import { BIG_ZERO, MIN_COLLATERAL_AMOUNT } from '@constants/index'
import { connectedWalletAtom, isTransactionFirstStepAtom, supportedNetworkAtom } from 'src/state/wallet/atoms'
import { addressesAtom, isLongAtom, vaultHistoryUpdatingAtom } from 'src/state/positions/atoms'
import { useComputeSwaps, useFirstValidVault } from 'src/state/positions/hooks'
import { useVaultData } from '@hooks/useVaultData'
import { useVaultManager } from '@hooks/contracts/useVaultManager'
import {
  useGetCollatRatioAndLiqPrice,
  useGetDebtAmount,
  useGetUniNFTCollatDetail,
  useUpdateOperator,
} from 'src/state/controller/hooks'
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
import useDebounce from '@utils/useDebounce'

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
  const [shortLoading, setShortLoading] = useState(false)
  const [msgValue, setMsgValue] = useState(new BigNumber(0))
  const [totalCollateralAmount, setTotalCollateralAmount] = useState(new BigNumber(0))
  const [isVaultApproved, setIsVaultApproved] = useState(true)
  const [openConfirm, setOpenConfirm] = useState(false)
  const [CRError, setCRError] = useState('')
  const [newCollat, setNewCollat] = useState(BIG_ZERO)
  const [totalExistingCollat, setTotalExistingCollat] = useState(BIG_ZERO)
  const [totalDebt, setTotalDebt] = useState(BIG_ZERO)
  const [exactOutAmount, setExactOutAmount] = useState(BIG_ZERO)
  const [loadingSaleProceeds, setLoadingSaleProceeds] = useState(false)

  const [ethTradeAmount, setEthTradeAmount] = useAtom(ethTradeAmountAtom)
  const [sqthTradeAmount, setSqthTradeAmount] = useAtom(sqthTradeAmountAtom)
  const resetSqthTradeAmount = useResetAtom(sqthTradeAmountAtom)
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
  const getExactOutSellQuote = useExactOutSellQuote()
  const flashSwapAndMint = useFlashSwapAndMint()
  const getDebtAmount = useGetDebtAmount()
  const { vaultId, validVault: vault } = useFirstValidVault()
  const { squeethAmount: shortSqueethAmount } = useComputeSwaps()
  const { cancelled, confirmed, failed, transactionData, resetTxCancelled, resetTransactionData } =
    useTransactionStatus()
  const [isVaultHistoryUpdating, setVaultHistoryUpdating] = useAtom(vaultHistoryUpdatingAtom)
  const { updateVault, loading: vaultIDLoading } = useVaultManager()
  const vaultHistoryQuery = useVaultHistoryQuery(Number(vaultId), isVaultHistoryUpdating)
  const { existingCollatPercent, existingLiqPrice } = useVaultData(vault)
  const updateOperator = useUpdateOperator()
  const selectWallet = useSelectWallet()
  const getCollatRatioAndLiqPrice = useGetCollatRatioAndLiqPrice()
  const ethPrice = useETHPrice()
  const getUniNFTCollatDetail = useGetUniNFTCollatDetail()
  const [collatPercent, setCollatPercent] = useState(existingCollatPercent ? existingCollatPercent : 200)
  const [liqPrice, setLiqPrice] = useState(existingLiqPrice.gt(0) ? existingLiqPrice : new BigNumber(0))

  const amount = useAppMemo(() => new BigNumber(sqthTradeAmount), [sqthTradeAmount])
  const collateral = useAppMemo(() => new BigNumber(ethTradeAmount), [ethTradeAmount])
  const debouncedAmount = useDebounce(amount, 600)

  let inputError = ''
  let priceImpactWarning: string | undefined
  let vaultIdDontLoadedError: string | undefined
  let lowVolError: string | undefined

  useAppEffect(() => {
    setCollatPercent(existingCollatPercent ? existingCollatPercent : 200)
  }, [existingCollatPercent])
  useAppEffect(() => {
    setLiqPrice(existingLiqPrice.gt(0) ? existingLiqPrice : new BigNumber(0))
  }, [existingLiqPrice])

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
      inputError = 'You need to sell more oSQTH or raise your CR.'
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

  const minCR = useAppMemo(
    () =>
      BigNumber.max(
        amount.gt(0) && (totalExistingCollat ?? BIG_ZERO).plus(quote.amountOut).dividedBy(totalDebt).isFinite()
          ? (totalExistingCollat ?? BIG_ZERO).plus(quote.amountOut).dividedBy(totalDebt)
          : BIG_ZERO,
        1.5,
      ),

    [quote.amountOut, totalDebt, totalExistingCollat, amount],
  )

  const onSqthChange = useAppCallback(
    async (value: string, collatPercent: number) => {
      try {
        const [quote, debt, existingDebt, NFTCollat] = await Promise.all([
          getSellQuote(new BigNumber(value), slippageAmount),
          getDebtAmount(new BigNumber(value)),
          getDebtAmount(vault?.shortAmount ?? BIG_ZERO),
          vault?.NFTCollateralId && getUniNFTCollatDetail(vault?.NFTCollateralId),
        ])

        const totalDebt = existingDebt.plus(debt)
        const totalExistingCollat = (vault?.collateralAmount ?? BIG_ZERO).plus(NFTCollat?.collateral ?? BIG_ZERO)
        const newCollat = new BigNumber(collatPercent / 100).multipliedBy(totalDebt).minus(totalExistingCollat ?? 0)
        getCollatRatioAndLiqPrice(
          newCollat.plus(vault?.collateralAmount ?? BIG_ZERO),
          new BigNumber(value).plus(vault?.shortAmount ?? BIG_ZERO),
          vault?.NFTCollateralId,
        ).then(({ liquidationPrice }) => {
          setLiqPrice(liquidationPrice)
        })

        setNewCollat(newCollat)
        setQuote(quote)
        setTotalExistingCollat(totalExistingCollat)
        setTotalDebt(totalDebt)

        if (quote.minimumAmountOut && newCollat.gt(quote.minimumAmountOut)) {
          setEthTradeAmount(newCollat.minus(quote.amountOut).toFixed(6))
          setMsgValue(newCollat.minus(quote.amountOut))
        } else if (newCollat.lte(0)) {
          setEthTradeAmount('0')
          return
        } else if (newCollat.lt(quote.amountOut)) {
          setEthTradeAmount('0')
          setMsgValue(new BigNumber(0))
        }

        setTotalCollateralAmount(quote.minimumAmountOut.plus(newCollat.minus(quote.minimumAmountOut)))
      } catch (error: any) {
        console.log(error?.message)
      }
    },
    [
      getCollatRatioAndLiqPrice,
      getDebtAmount,
      getSellQuote,
      getUniNFTCollatDetail,
      setEthTradeAmount,
      setQuote,
      slippageAmount,
      vault?.NFTCollateralId,
      vault?.collateralAmount,
      vault?.shortAmount,
    ],
  )
  const handleSqthChange = useAppMemo(() => debounce(onSqthChange, 500), [onSqthChange])

  useAppEffect(() => {
    if (!debouncedAmount || debouncedAmount.lte(0)) return setExactOutAmount(BIG_ZERO)
    setLoadingSaleProceeds(true)
    getExactOutSellQuote(new BigNumber(debouncedAmount))
      .then((val) => {
        setExactOutAmount(val)
        setLoadingSaleProceeds(false)
      })
      .catch((e) => {
        setLoadingSaleProceeds(false)
        setExactOutAmount(quote.amountOut)
      })
  }, [debouncedAmount, getExactOutSellQuote, quote.amountOut])

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

  useAppEffect(() => {
    const timeout = setTimeout(() => {
      if (new BigNumber(collatPercent / 100).lt(minCR ?? BIG_ZERO)) {
        setCollatPercent(Number(minCR.times(100).toFixed(1)))
        setCRError('')
      }
    }, 1000)

    return () => clearTimeout(timeout)
  }, [collatPercent, minCR])

  const handleCollatRatioChange = (value: string) => {
    onSqthChange(sqthTradeAmount, Number(value))
    if (new BigNumber(Number(value) / 100).lt(minCR ?? BIG_ZERO)) {
      setCRError(`Minimum CR is ${minCR.times(100).toFixed(1)}%`)
    } else {
      setCRError('')
    }
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
        await flashSwapAndMint(Number(vaultId), totalCollateralAmount, amount, quote.minimumAmountOut, msgValue, () => {
          setIsTxFirstStep(false)
          setConfirmedAmount(amount.toFixed(6).toString())
          setTradeSuccess(true)
          setTradeCompleted(true)
          resetSqthTradeAmount()
          resetEthTradeAmount()
          setCRError('')
          setCollatPercent(existingCollatPercent ? existingCollatPercent : 200)
          setVaultHistoryUpdating(true)
          setShortLoading(false)
          vaultHistoryQuery.refetch({ vaultId })
          setNewCollat(BIG_ZERO)
          updateVault()
        })
      }
    } catch (e) {
      console.log(e)
      setShortLoading(false)
    }
  }, [
    amount,
    existingCollatPercent,
    flashSwapAndMint,
    isVaultApproved,
    msgValue,
    quote.minimumAmountOut,
    resetEthTradeAmount,
    resetSqthTradeAmount,
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
        <div id="open-short-confirmed-card">
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
              Close
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
                handleSqthChange(val, collatPercent)
              }}
              label="Sell"
              unit="oSQTH"
              // tooltip={Tooltips.SellOpenAmount}
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
                id="open-short-collat-ratio-input"
                label="Collateral ratio for vault after trade"
                variant="outlined"
                error={collatPercent < 150 || CRError !== ''}
                helperText={`Min Collateralization Ratio: ${minCR.times(100).toFixed(1)}%`}
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
              <p
                style={{
                  textAlign: 'left',
                  width: '300px',
                  margin: '0 auto',
                  fontSize: '.75rem',
                  color: 'rgba(255,255,255,0.5)',
                }}
              >
                {CRError !== '' ? CRError : 'At risk of liquidation at 150%'}
              </p>
            </div>
            <div className={classes.thirdHeading}></div>
            <CollatRange
              onCollatValueChange={(val) => {
                if (new BigNumber(val / 100).lt(minCR ?? BIG_ZERO)) {
                  setCRError(`Minimum CR is ${minCR.times(100).toFixed(1)}%`)
                  return
                } else {
                  setCRError('')
                }
                setCollatPercent(val)
                onSqthChange(sqthTradeAmount, val)
              }}
              collatValue={collatPercent}
            />
            <VaultCard
              error={{
                vaultCollat: inputError.includes('You need to sell more oSQTH') ? inputError : '',
              }}
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
              id="open-short-vault-card"
            />
            <TradeDetails
              actionTitle="Collateral to deposit"
              amount={ethTradeAmount}
              unit="ETH"
              value={!collateral.isNaN() ? collateral.times(ethPrice).toFixed(2).toLocaleString() : '0'}
              hint={
                inputError ? (
                  <span style={{ color: '#f5475c' }}>{inputError}</span>
                ) : priceImpactWarning ? (
                  <span style={{ color: '#f5475c' }}>{priceImpactWarning}</span>
                ) : lowVolError ? (
                  <span style={{ color: '#f5475c' }}> {lowVolError}</span>
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
              id="open-short-eth-display"
            />

            <TradeDetails
              actionTitle="Expected sale proceeds to deposit"
              amount={exactOutAmount.toFixed(6)}
              unit="ETH"
              value={!exactOutAmount.isNaN() ? exactOutAmount.times(ethPrice).toFixed(2).toLocaleString() : '0'}
              hint=""
              id="open-short-collateral-from-sale"
              isLoading={loadingSaleProceeds}
              loadingMessage="Fetching expected proceeds"
            />

            <div className={classes.divider}>
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
                  (vault && vault.shortAmount.isZero()) ||
                  new BigNumber(collatPercent / 100).lt(minCR ?? BIG_ZERO)
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
                      <Tooltip
                        style={{ marginLeft: '2px' }}
                        title={
                          <span>
                            The wrapper contract helps you put on short positions and LP positions in one step instead
                            of many.<a href="https://www.opyn.co/">Learn more</a>
                          </span>
                        }
                      >
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

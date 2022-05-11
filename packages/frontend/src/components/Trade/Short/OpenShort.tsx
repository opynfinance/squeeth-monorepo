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
import { useIntergrateEthInput } from '@hooks/useIntegrateEthInput'
import { useFlashSwapAndMint } from 'src/state/controllerhelper/hooks'
import { useTransactionStatus, useWalletBalance } from 'src/state/wallet/hooks'
import { toTokenAmount } from '@utils/calculations'
import { BIG_ZERO, MIN_COLLATERAL_AMOUNT } from '@constants/index'
import { connectedWalletAtom, isTransactionFirstStepAtom, supportedNetworkAtom } from 'src/state/wallet/atoms'
import { addressesAtom, isLongAtom, vaultHistoryUpdatingAtom } from 'src/state/positions/atoms'
import { useComputeSwaps, useFirstValidVault } from 'src/state/positions/hooks'
import { useVaultData } from '@hooks/useVaultData'
import { useVaultManager } from '@hooks/contracts/useVaultManager'
import { useGetDebtAmount, useUpdateOperator } from 'src/state/controller/hooks'
import TradeInfoItem from '../TradeInfoItem'
import UniswapData from '../UniswapData'
import Confirmed, { ConfirmType } from '@components/Trade/Confirmed'
import Cancelled from '../Cancelled'
import useAppEffect from '@hooks/useAppEffect'
import useAppCallback from '@hooks/useAppCallback'
import useAppMemo from '@hooks/useAppMemo'
import { useVaultHistoryQuery } from '@hooks/useVaultHistory'

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

export const OpenShortPosition = ({ open }: { open: boolean }) => {
  const classes = useStyles()
  const [collatPercent, setCollatPercent] = useState(200)
  const [neededCollat, setNeededCollat] = useState(new BigNumber(0))
  const [minToReceive, setMinToReceive] = useState(new BigNumber(0))
  const [confirmedAmount, setConfirmedAmount] = useState('0')
  const [liqPrice, setLiqPrice] = useState(new BigNumber(0))
  const [shortLoading, setShortLoading] = useState(false)
  const [msgValue, setMsgValue] = useState(new BigNumber(0))
  const [totalCollateralAmount, setTotalCollateralAmount] = useState(new BigNumber(0))
  const [lastTypedInput, setLastTypedInput] = useState<'eth' | 'sqth' | null>(null)
  const [isVaultApproved, setIsVaultApproved] = useState(true)
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

  const { data } = useWalletBalance()
  const balance = Number(toTokenAmount(data ?? BIG_ZERO, 18).toFixed(4))
  const getSellQuote = useGetSellQuote()
  const integrateETHInput = useIntergrateEthInput()
  const flashSwapAndMint = useFlashSwapAndMint()
  const getDebtAmount = useGetDebtAmount()
  const { vaultId, validVault: vault } = useFirstValidVault()
  const { squeethAmount: shortSqueethAmount } = useComputeSwaps()
  const [isTxFirstStep, setIsTxFirstStep] = useAtom(isTransactionFirstStepAtom)
  const { cancelled, confirmed, failed, transactionData, resetTxCancelled, resetTransactionData } =
    useTransactionStatus()
  const [isVaultHistoryUpdating, setVaultHistoryUpdating] = useAtom(vaultHistoryUpdatingAtom)
  const { updateVault, loading: vaultIDLoading } = useVaultManager()
  const vaultHistoryQuery = useVaultHistoryQuery(Number(vaultId), isVaultHistoryUpdating)
  const { existingCollatPercent } = useVaultData(vault)
  const updateOperator = useUpdateOperator()

  const amount = useAppMemo(() => new BigNumber(sqthTradeAmount), [sqthTradeAmount])
  const collateral = useAppMemo(() => new BigNumber(ethTradeAmount), [ethTradeAmount])

  let inputError = ''
  let priceImpactWarning: string | undefined
  let vaultIdDontLoadedError: string | undefined

  useAppEffect(() => {
    if (vault) {
      const restOfShort = new BigNumber(vault?.shortAmount).minus(amount)

      getDebtAmount(restOfShort).then((debt) => {
        const _neededCollat = debt.times(collatPercent / 100)
        setNeededCollat(_neededCollat)
      })
    }
  }, [amount, collatPercent, getDebtAmount, vault])

  if (connected) {
    if (new BigNumber(quote.priceImpact).gt(3)) {
      priceImpactWarning = 'High Price Impact'
    }
    if (collateral.isGreaterThan(new BigNumber(balance))) {
      inputError = 'Insufficient ETH balance'
    } else if (
      amount.isGreaterThan(0) &&
      collateral.plus(vault?.collateralAmount || BIG_ZERO).lt(MIN_COLLATERAL_AMOUNT)
    ) {
      inputError = `Minimum collateral is ${MIN_COLLATERAL_AMOUNT} ETH`
    } else if (vault && vaultId === 0 && vault?.shortAmount.gt(0)) {
      vaultIdDontLoadedError = 'Loading Vault...'
    }
    if (
      !open &&
      amount.isGreaterThan(0) &&
      vault &&
      amount.lt(vault.shortAmount) &&
      neededCollat.isLessThan(MIN_COLLATERAL_AMOUNT)
    ) {
      inputError = `You must have at least ${MIN_COLLATERAL_AMOUNT} ETH collateral unless you fully close out your position. Either fully close your position, or close out less`
    }
    if (isLong) {
      inputError = 'Close your long position to open a short'
    }
  }

  const onSqthChange = useAppCallback(
    async (value: string) => {
      const [quote, debt] = await Promise.all([getSellQuote(new BigNumber(value)), getDebtAmount(new BigNumber(value))])
      const result = debt.times(new BigNumber(collatPercent / 100)).minus(quote.amountOut)
      setTotalCollateralAmount(debt.times(new BigNumber(collatPercent / 100)))
      setMsgValue(result)
      setEthTradeAmount(result.toFixed(6))
      setQuote(quote)
    },
    [collatPercent, getDebtAmount, getSellQuote, setEthTradeAmount, setQuote],
  )
  const handleSqthChange = useAppMemo(() => debounce(onSqthChange, 500), [onSqthChange])

  const onEthChange = useAppCallback(
    async (value: string) => {
      console.log({ value, collatPercent, slippageAmount: slippageAmount.toString() })

      setMsgValue(new BigNumber(value))
      const { squeethAmount, ethBorrow, quote, liqPrice } = await integrateETHInput(
        new BigNumber(value),
        collatPercent / 100,
        slippageAmount,
      )

      setLiqPrice(liqPrice)
      setSqthTradeAmount(squeethAmount.isZero() ? squeethAmount.toString() : squeethAmount.toFixed(6))
      setMinToReceive(ethBorrow)
      setQuote(quote)
      if (!squeethAmount.isZero()) {
        const debt = await getDebtAmount(squeethAmount)
        setTotalCollateralAmount(debt.times(new BigNumber(collatPercent / 100)))
      }
    },
    [collatPercent, getDebtAmount, integrateETHInput, setQuote, setSqthTradeAmount, slippageAmount],
  )

  const handleEthChange = useAppMemo(() => debounce(onEthChange, 500), [onEthChange])

  useAppEffect(() => {
    if (lastTypedInput === 'sqth') {
      onSqthChange(sqthTradeAmount)
    }

    if (lastTypedInput === 'eth') {
      onEthChange(ethTradeAmount)
    }
  }, [ethTradeAmount, lastTypedInput, onEthChange, onSqthChange, sqthTradeAmount])

  useAppEffect(() => {
    if (failed) setShortLoading(false)
  }, [failed])

  useAppEffect(() => {
    if (!vaultId || !vault) return

    setIsVaultApproved(vault?.operator?.toLowerCase() === controllerHelper?.toLowerCase())
  }, [controllerHelper, vault, vaultId])

  const handleSubmit = useAppCallback(async () => {
    setShortLoading(true)
    try {
      if (vaultIDLoading) {
        setShortLoading(false)
        return
      }
      if (vaultId && !isVaultApproved) {
        setIsTxFirstStep(true)
        await updateOperator(Number(vaultId), controllerHelper, () => {
          setIsVaultApproved(true)
          setShortLoading(false)
        })
      } else {
        await flashSwapAndMint(Number(vaultId), totalCollateralAmount, amount, minToReceive, msgValue, () => {
          setIsTxFirstStep(false)
          setConfirmedAmount(amount.toFixed(6).toString())
          setTradeSuccess(true)
          setTradeCompleted(true)
          resetEthTradeAmount()
          setVaultHistoryUpdating(true)
          vaultHistoryQuery.refetch({ vaultId })
          setCollatPercent(150)
          updateVault()
        })
      }
    } catch (e) {
      console.log(e)
      setShortLoading(false)
    }
  }, [
    amount,
    controllerHelper,
    flashSwapAndMint,
    isVaultApproved,
    minToReceive,
    msgValue,
    resetEthTradeAmount,
    setIsTxFirstStep,
    setTradeCompleted,
    setTradeSuccess,
    setVaultHistoryUpdating,
    totalCollateralAmount,
    updateOperator,
    updateVault,
    vaultHistoryQuery,
    vaultIDLoading,
    vaultId,
  ])

  const shortOpenPriceImpactErrorState = priceImpactWarning && !shortLoading && !(collatPercent < 150) && !inputError

  return (
    <>
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
              Mint and sell squeeth to receive funding
            </Typography>
            <span className={classes.settingsButton}>
              <TradeSettings />
            </span>
          </div>
          <form>
            <PrimaryInput
              name="eth"
              value={ethTradeAmount}
              onChange={(val) => {
                setEthTradeAmount(val)
                setLastTypedInput('eth')
                handleEthChange(val)
              }}
              label="Collateral"
              actionTxt="Max"
              unit="ETH"
              tooltip={Tooltips.SellOpenAmount}
              onActionClicked={() => setEthTradeAmount(balance.toString())}
              error={Boolean(inputError) || Boolean(priceImpactWarning)}
              hint={
                inputError ? (
                  inputError
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
                        </span>
                      </>
                    ) : null}
                    <span style={{ marginLeft: '4px' }}>ETH</span>
                  </div>
                )
              }
              id="open-short-eth-input"
            />
            <div className={classes.thirdHeading}>
              <TextField
                size="small"
                value={collatPercent}
                type="number"
                style={{ width: 300 }}
                onChange={(event) => {
                  setCollatPercent(Number(event.target.value))
                }}
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
            <CollatRange
              onCollatValueChange={(val) => {
                setCollatPercent(val)
              }}
              collatValue={collatPercent}
            />
            <PrimaryInput
              name="sqth"
              id="open-short-sqth-input"
              value={sqthTradeAmount}
              onChange={(val) => {
                setSqthTradeAmount(val)
                setLastTypedInput('sqth')
                handleSqthChange(val)
              }}
              label="Sell"
              unit="oSQTH"
              tooltip={Tooltips.SellOpenAmount}
              hint={
                inputError ? (
                  inputError
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
            {!connected ? (
              <PrimaryButton
                variant="contained"
                // onClick={selectWallet}
                className={classes.amountInput}
                // style={{ width: '300px' }}
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

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
import { useEffect, useMemo, useState } from 'react'
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
import { useFlashSwapAndMint } from 'src/state/controllerHelper/hooks'
import { useTransactionStatus, useWalletBalance } from 'src/state/wallet/hooks'
import { toTokenAmount } from '@utils/calculations'
import { BIG_ZERO, MIN_COLLATERAL_AMOUNT } from '@constants/index'
import { connectedWalletAtom, isTransactionFirstStepAtom } from 'src/state/wallet/atoms'
import { addressesAtom, isLongAtom } from 'src/state/positions/atoms'
import { useComputeSwaps, useFirstValidVault } from 'src/state/positions/hooks'
import { useVaultData } from '@hooks/useVaultData'
import { useVaultManager } from '@hooks/contracts/useVaultManager'
import { useGetDebtAmount, useUpdateOperator } from 'src/state/controller/hooks'
import TradeInfoItem from '../TradeInfoItem'
import UniswapData from '../UniswapData'
import Confirmed, { ConfirmType } from '@components/Trade/Confirmed'
import Cancelled from '../Cancelled'
import { normFactorAtom } from 'src/state/controller/atoms'
import useAppEffect from '@hooks/useAppEffect'

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
      marginLeft: theme.spacing(10),
      justifyContent: 'right',
    },
    settingsContainer: {
      display: 'flex',
      justify: 'space-between',
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
  const [collatPercent, setCollatPercent] = useState(150)
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
  const { firstValidVault, vaultId } = useFirstValidVault()
  const { vaults: shortVaults, loading: vaultIDLoading } = useVaultManager()
  const { squeethAmount: shortSqueethAmount } = useComputeSwaps()
  const { existingCollatPercent } = useVaultData(vaultId)
  const normalizationFactor = useAtomValue(normFactorAtom)
  const [isTxFirstStep, setIsTxFirstStep] = useAtom(isTransactionFirstStepAtom)
  const { cancelled, confirmed, failed, transactionData, resetTxCancelled, resetTransactionData } =
    useTransactionStatus()
  const updateOperator = useUpdateOperator()

  const amount = new BigNumber(sqthTradeAmount)
  const collateral = new BigNumber(ethTradeAmount)

  let inputError = ''
  let priceImpactWarning: string | undefined
  let vaultIdDontLoadedError: string | undefined

  useAppEffect(() => {
    if (shortVaults.length) {
      const restOfShort = new BigNumber(shortVaults[firstValidVault].shortAmount).minus(amount)

      getDebtAmount(new BigNumber(restOfShort)).then((debt) => {
        const _neededCollat = debt.times(collatPercent / 100)
        setNeededCollat(_neededCollat)
      })
    }
  }, [amount, collatPercent, firstValidVault, getDebtAmount, shortVaults])

  if (connected) {
    // if (
    //   !open &&
    //   shortVaults.length &&
    //   (shortVaults[firstValidVault].shortAmount.lt(amount) || shortVaults[firstValidVault].shortAmount.isZero())
    // ) {
    //   inputError = 'Close amount exceeds position'
    // }
    if (new BigNumber(quote.priceImpact).gt(3)) {
      priceImpactWarning = 'High Price Impact'
    }
    if (collateral.isGreaterThan(new BigNumber(balance))) {
      inputError = 'Insufficient ETH balance'
    } else if (
      amount.isGreaterThan(0) &&
      collateral.plus(shortVaults[firstValidVault]?.collateralAmount || BIG_ZERO).lt(MIN_COLLATERAL_AMOUNT)
    ) {
      inputError = `Minimum collateral is ${MIN_COLLATERAL_AMOUNT} ETH`
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
      inputError = `You must have at least ${MIN_COLLATERAL_AMOUNT} ETH collateral unless you fully close out your position. Either fully close your position, or close out less`
    }
    if (isLong) {
      inputError = 'Close your long position to open a short'
    }
  }

  useAppEffect(() => {
    const rSqueeth = normalizationFactor.multipliedBy(amount || 1).dividedBy(10000)
    const liqp = collateral.dividedBy(rSqueeth.multipliedBy(1.5))
    if (liqp.toString() || liqp.toString() !== '0') setLiqPrice(liqp)
  }, [amount, collateral, normalizationFactor])

  const onSqthChange = async (value: string) => {
    const [quote, debt] = await Promise.all([getSellQuote(new BigNumber(value)), getDebtAmount(new BigNumber(value))])

    const result = debt.times(new BigNumber(collatPercent / 100)).minus(quote.amountOut)
    setTotalCollateralAmount(debt.times(new BigNumber(collatPercent / 100)))
    setMsgValue(result)
    setEthTradeAmount(result.toFixed(6))
    setQuote(quote)
  }
  const handleSqthChange = useMemo(() => debounce(onSqthChange, 500), [getSellQuote, getDebtAmount, collatPercent])

  const onEthChange = async (value: string) => {
    setMsgValue(new BigNumber(value))
    const { squeethAmount, ethBorrow, quote } = await integrateETHInput(
      new BigNumber(value),
      collatPercent / 100,
      slippageAmount,
    )
    setSqthTradeAmount(squeethAmount.toFixed(6))
    setMinToReceive(ethBorrow)
    setQuote(quote)
    if (!squeethAmount.isZero()) {
      const debt = await getDebtAmount(squeethAmount)
      setTotalCollateralAmount(debt.times(new BigNumber(collatPercent / 100)))
    }
  }

  const handleEthChange = useMemo(
    () => debounce(onEthChange, 500),
    [integrateETHInput, collatPercent, slippageAmount.toString()],
  )

  useEffect(() => {
    if (lastTypedInput === 'sqth') {
      onSqthChange(sqthTradeAmount)
    }

    if (lastTypedInput === 'eth') {
      onEthChange(ethTradeAmount)
    }
  }, [collatPercent, ethTradeAmount, lastTypedInput, sqthTradeAmount])

  useEffect(() => {
    if (failed) setShortLoading(false)
  }, [failed])

  useEffect(() => {
    if (!vaultId || !shortVaults?.length) return

    setIsVaultApproved(shortVaults[firstValidVault]?.operator?.toLowerCase() === controllerHelper?.toLowerCase())
  }, [controllerHelper, firstValidVault, shortVaults[firstValidVault]?.operator, vaultId])

  const handleSubmit = async () => {
    setShortLoading(true)
    try {
      if (vaultIDLoading) {
        setShortLoading(false)
        return
      }
      if (vaultId && !isVaultApproved) {
        setIsTxFirstStep(true)
        await updateOperator(vaultId, controllerHelper, () => {
          setIsVaultApproved(true)
          setShortLoading(false)
        })
      } else {
        await flashSwapAndMint(vaultId, totalCollateralAmount, amount, minToReceive, msgValue, () => {
          setIsTxFirstStep(false)
          setConfirmedAmount(amount.toFixed(6).toString())
          setShortLoading(false)
          setTradeSuccess(true)
          setTradeCompleted(true)
          resetEthTradeAmount()
          setCollatPercent(150)
        })
      }
    } catch (e) {
      console.log(e)
      setShortLoading(false)
    }
  }

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
            <Typography variant="caption" className={classes.explainer} component="div">
              Mint & sell squeeth for premium
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
              value={sqthTradeAmount}
              onChange={(val) => {
                setSqthTradeAmount(val)
                setLastTypedInput('sqth')
                handleSqthChange(val)
              }}
              label="Minted Sqth"
              unit="oSQTH"
              tooltip={Tooltips.SellOpenAmount}
              hint={
                inputError ? (
                  inputError
                ) : (
                  <div className={classes.hint}>
                    <span className={classes.hintTextContainer}>
                      <span className={classes.hintTitleText}>Position</span>
                      <span>{shortSqueethAmount.toFixed(4)}</span>
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
            {!connected ? (
              <PrimaryButton
                variant="contained"
                // onClick={selectWallet}
                className={classes.amountInput}
                // style={{ width: '300px' }}
              >
                Connect Wallet
              </PrimaryButton>
            ) : (
              <PrimaryButton
                onClick={handleSubmit}
                className={classes.amountInput}
                disabled={
                  shortLoading ||
                  Boolean(inputError) ||
                  Boolean(vaultIdDontLoadedError) ||
                  amount.isZero() ||
                  collateral.isZero() ||
                  collatPercent < 150
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

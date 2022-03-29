import { createStyles, makeStyles, Typography, InputAdornment, TextField } from '@material-ui/core'
import { useAtom, useAtomValue } from 'jotai'
import { useCallback, useEffect, useState } from 'react'
import debounce from 'lodash.debounce'
import BigNumber from 'bignumber.js'
import ArrowRightAltIcon from '@material-ui/icons/ArrowRightAlt'

import { TradeSettings } from '@components/TradeSettings'
import { PrimaryInput } from '@components/Input/PrimaryInput'
import { ethTradeAmountAtom, quoteAtom, sqthTradeAmountAtom } from 'src/state/trade/atoms'
import { Tooltips, Links } from '@constants/enums'
import CollatRange from '@components/CollatRange'
import { PrimaryButton } from '@components/Button'
import { useGetSellQuote } from 'src/state/squeethPool/hooks'
import { useIntergrateEthInput } from '@hooks/useIntegrateEthInput'
import { useFlashSwapAndMint } from 'src/state/controllerhelper/hooks'
import { useWalletBalance } from 'src/state/wallet/hooks'
import { toTokenAmount } from '@utils/calculations'
import { BIG_ZERO, MIN_COLLATERAL_AMOUNT } from '@constants/index'
import { connectedWalletAtom } from 'src/state/wallet/atoms'
import { isLongAtom } from 'src/state/positions/atoms'
import { useFirstValidVault } from 'src/state/positions/hooks'
import { useVaultData } from '@hooks/useVaultData'
import { useVaultManager } from '@hooks/contracts/useVaultManager'
import { useGetDebtAmount } from 'src/state/controller/hooks'

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
  }),
)

export const OpenShortPosition = ({ open }: { open: boolean }) => {
  const classes = useStyles()
  const [collatPercent, setCollatPercent] = useState(150)
  const [neededCollat, setNeededCollat] = useState(new BigNumber(0))
  const [minToReceive, setMinToReceive] = useState(new BigNumber(0))
  const [ethTradeAmount, setEthTradeAmount] = useAtom(ethTradeAmountAtom)
  const [sqthTradeAmount, setSqthTradeAmount] = useAtom(sqthTradeAmountAtom)
  const [quote, setQuote] = useAtom(quoteAtom)
  const connected = useAtomValue(connectedWalletAtom)
  const isLong = useAtomValue(isLongAtom)

  const { data } = useWalletBalance()
  const balance = Number(toTokenAmount(data ?? BIG_ZERO, 18).toFixed(4))
  const getSellQuote = useGetSellQuote()
  const integrateETHInput = useIntergrateEthInput()
  const flashSwapAndMint = useFlashSwapAndMint()
  const getDebtAmount = useGetDebtAmount()
  const { firstValidVault, vaultId } = useFirstValidVault()
  const { vaults: shortVaults } = useVaultManager()

  const amount = new BigNumber(sqthTradeAmount)
  const collateral = new BigNumber(ethTradeAmount)

  let inputError = ''
  let priceImpactWarning: string | undefined
  let vaultIdDontLoadedError: string | undefined

  useEffect(() => {
    if (shortVaults.length) {
      const restOfShort = new BigNumber(shortVaults[firstValidVault].shortAmount).minus(amount)

      getDebtAmount(new BigNumber(restOfShort)).then((debt) => {
        const _neededCollat = debt.times(collatPercent / 100)
        setNeededCollat(_neededCollat)
      })
    }
  }, [amount.toString(), collatPercent, shortVaults?.length])

  if (connected) {
    if (
      shortVaults.length &&
      (shortVaults[firstValidVault].shortAmount.lt(amount) || shortVaults[firstValidVault].shortAmount.isZero())
    ) {
      inputError = 'Close amount exceeds position'
    }
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

  const handleChange = useCallback(
    debounce((value: string, name: string | undefined) => {
      if (name === 'sqth') {
        if (Number(value) <= 0) return setEthTradeAmount('0')
        getSellQuote(new BigNumber(value)).then((quote) => {
          setQuote(quote)
          setEthTradeAmount(quote.amountOut.toFixed(6))
        })
      } else if (name === 'eth') {
        if (Number(value) <= 0) return setSqthTradeAmount('0')
        integrateETHInput(new BigNumber(value), collatPercent / 100, new BigNumber(0.1)).then((data) => {
          setSqthTradeAmount(data.squeethAmount.toFixed(6))
          setMinToReceive(data.ethBorrow)
        })
      }
    }, 500),
    [getSellQuote, collatPercent, integrateETHInput],
  )

  const handleSubmit = async () => {
    const response = await flashSwapAndMint(vaultId, collateral, amount, minToReceive)
    // console.log({ response })
  }

  return (
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
          onChange={(val, name) => {
            setEthTradeAmount(val)
            handleChange(val, name)
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
        <CollatRange
          onCollatValueChange={(val) => {
            setCollatPercent(val)
            integrateETHInput(new BigNumber(ethTradeAmount), val / 100, new BigNumber(0.1)).then((data) => {
              setSqthTradeAmount(data.squeethAmount.toFixed(6))
              setMinToReceive(data.ethBorrow)
            })
          }}
          collatValue={collatPercent}
        />
        <PrimaryInput
          name="sqth"
          value={sqthTradeAmount}
          onChange={(val, name) => {
            setSqthTradeAmount(val)
            handleChange(val, name)
          }}
          label="Minted Sqth"
          actionTxt="Max"
          unit="oSQTH"
          tooltip={Tooltips.SellOpenAmount}
          onActionClicked={() => setSqthTradeAmount('500')}
          hint={<div>Hint section</div>}
        />
        <PrimaryButton
          onClick={handleSubmit}
          variant="contained"
          className={classes.amountInput}
          disabled={
            Boolean(inputError) ||
            Boolean(vaultIdDontLoadedError) ||
            amount.isZero() ||
            collateral.isZero() ||
            collatPercent < 150
          }
        >
          Open Short
        </PrimaryButton>
      </form>
      <Typography variant="caption" className={classes.caption} component="div">
        <a href={Links.UniswapSwap} target="_blank" rel="noreferrer">
          {' '}
          Trades on Uniswap V3 🦄{' '}
        </a>
      </Typography>
    </>
  )
}

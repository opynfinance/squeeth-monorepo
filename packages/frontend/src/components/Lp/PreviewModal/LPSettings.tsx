import React, { useState, useCallback, useEffect } from 'react'
import { Box, Typography, Divider, InputAdornment, Collapse } from '@material-ui/core'
import { ToggleButtonGroup, ToggleButton } from '@material-ui/lab'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import { useAtomValue } from 'jotai'
import BigNumber from 'bignumber.js'
import { TickMath } from '@uniswap/v3-sdk'
import { useDebounce } from 'use-debounce'
import Image from 'next/image'
import clsx from 'clsx'

import { AltPrimaryButton } from '@components/Button'
import { useETHPrice } from '@hooks/useETHPrice'
import useAppCallback from '@hooks/useAppCallback'
import useAppEffect from '@hooks/useAppEffect'
import {
  useGetTicksFromETHPrice,
  useOpenPositionDeposit,
  useGetMintAndLPDeposits,
  MIN_COLLATERAL_RATIO,
  useGetLiquidationPrice,
} from '@state/lp/hooks'
import { slippageAmountAtom } from '@state/trade/atoms'
import { useWalletBalance } from '@state/wallet/hooks'
import { toTokenAmount } from '@utils/calculations'
import { getErrorMessage } from '@utils/error'
import { formatTokenAmount, formatCurrency } from '@utils/formatter'
import { BIG_ZERO, WETH_DECIMALS, OSQUEETH_DECIMALS, MIN_COLLATERAL_AMOUNT } from '@constants/index'

import InfoBox from '../InfoBox'
import { InputNumber, InputTokenDense } from '../Input'
import Checkbox from '../Checkbox'
import CollatRatioSlider from '../CollatRatioSlider'
import Alert from '../Alert'
import { useTypographyStyles } from '../styles'
import ethLogo from 'public/images/eth-logo.svg'

const useToggleButtonStyles = makeStyles((theme) => ({
  root: {
    textTransform: 'none',
    padding: theme.spacing(0.25, 1.25),
    color: theme.palette.primary.contrastText,

    '&.Mui-selected, &.Mui-selected:hover': {
      color: theme.palette.background.default,
      backgroundColor: theme.palette.primary.main,
    },
  },
}))

const useModalStyles = makeStyles((theme) =>
  createStyles({
    container: {
      margin: '5em auto 0px',
      width: '80%',
      maxHeight: '90%',
      maxWidth: '640px',
      padding: theme.spacing(6),
      background: theme.palette.background.default,
      borderRadius: 20,
      overflow: 'scroll',
      display: 'block',
    },
    title: {
      fontSize: '24px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: 700,
    },
    priceContainer: {
      backgroundColor: theme.palette.background.lightStone,
      padding: theme.spacing(0.75, 1.5),
      borderRadius: '8px',
    },
    divider: {
      height: '2px',
      backgroundColor: theme.palette.background.lightStone,
      margin: theme.spacing(4, 0),
      display: 'inline-block',
      width: '100%',
    },
    logoContainer: {
      width: '40px',
      height: '40px',
      marginRight: theme.spacing(1),
      backgroundColor: theme.palette.background.lightStone,
      borderRadius: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logo: {
      height: '20px',
      width: '20px',
    },
  }),
)

const LPSettings: React.FC<{
  ethToDeposit: string
  setETHToDeposit: React.Dispatch<React.SetStateAction<string>>
  onConfirm: () => void
  onTxSuccess: () => void
  onTxFail: (message: string) => void
}> = ({ ethToDeposit, setETHToDeposit, onConfirm, onTxSuccess, onTxFail }) => {
  const [usingDefaultPriceRange, setUsingDefaultPriceRange] = useState(true)
  const [minLPPrice, setMinLPPrice] = useState('0')
  const [maxLPPrice, setMaxLPPrice] = useState('0')
  const [usingUniswapLPNFTAsCollat, setUsingUniswapLPNFTAsCollat] = useState(true)
  const [usingDefaultCollatRatio, setUsingDefaultCollatRatio] = useState(true)
  const [collatRatioPercent, setCollatRatioPercent] = useState(225)
  const [lowerTick, setLowerTick] = useState(TickMath.MIN_TICK)
  const [upperTick, setUpperTick] = useState(TickMath.MAX_TICK)
  const slippageAmountPercent = useAtomValue(slippageAmountAtom)

  const [ethInLP, setETHInLP] = useState(BIG_ZERO)
  const [ethInVault, setETHInVault] = useState(BIG_ZERO)
  const [effectiveCollateralInVault, setEffectiveCollateralInVault] = useState(BIG_ZERO)
  const [oSQTHToMint, setOSQTHToMint] = useState(BIG_ZERO)
  const [minCollatRatioPercent, setMinCollatRatioPercent] = useState(MIN_COLLATERAL_RATIO)
  const [loadingDepositAmounts, setLoadingDepositAmounts] = useState(false)
  const [liquidationPrice, setLiquidationPrice] = useState(0)

  const [ethInputError, setETHInputError] = useState('')
  const [lpPriceError, setLPPriceError] = useState('')
  const [showUniswapLPNFTWarning, setShowUniswapLPNFTWarning] = useState(false)
  const [showMinCollatError, setShowMinCollatError] = useState(false)

  const { data: walletBalance } = useWalletBalance()
  const ethPrice = useETHPrice()
  const getTicksFromETHPrice = useGetTicksFromETHPrice()
  const getMintAndLPDeposits = useGetMintAndLPDeposits()
  const getLiquidationPrice = useGetLiquidationPrice()
  const openLPPosition = useOpenPositionDeposit()

  const [ethToDepositDebounced] = useDebounce(ethToDeposit, 500)
  const [minLPPriceDebounced] = useDebounce(minLPPrice, 500)
  const [maxLPPriceDebounced] = useDebounce(maxLPPrice, 500)

  const slippageAmount = new BigNumber(slippageAmountPercent).div(100).toNumber()
  const ethBalance = toTokenAmount(walletBalance ?? BIG_ZERO, 18)

  const classes = useModalStyles()
  const toggleButtonClasses = useToggleButtonStyles()
  const typographyClasses = useTypographyStyles()

  useEffect(() => {
    if (ethBalance.lt(ethToDeposit)) {
      setETHInputError('Insufficient balance')
    } else {
      setETHInputError('')
    }
  }, [ethToDeposit, ethBalance])

  const handleBalanceClick = useCallback(
    () => setETHToDeposit(ethBalance.toFixed(4, BigNumber.ROUND_DOWN)),
    [ethBalance, setETHToDeposit],
  )

  const handleUniswapNftAsCollatToggle = useCallback((value: boolean | null) => {
    if (value !== null) {
      if (!value) {
        setShowUniswapLPNFTWarning(true)
      } else {
        setShowUniswapLPNFTWarning(false)
      }

      setUsingUniswapLPNFTAsCollat(value)
    }
  }, [])

  const handleCollatRatioPercentChange = useCallback((inputValue: string) => {
    setCollatRatioPercent(Number(inputValue))
  }, [])

  useAppEffect(() => {
    if (usingDefaultPriceRange) {
      setLPPriceError('')

      setLowerTick(TickMath.MIN_TICK)
      setUpperTick(TickMath.MAX_TICK)
      return
    }

    const minLPPriceBN = new BigNumber(minLPPriceDebounced)
    const maxLPPriceBN = new BigNumber(maxLPPriceDebounced)

    if (minLPPriceBN.lt(maxLPPriceBN)) {
      setLPPriceError('')

      const ticks = getTicksFromETHPrice(minLPPriceBN, maxLPPriceBN)
      setLowerTick(ticks.lowerTick)
      setUpperTick(ticks.upperTick)
    } else {
      setLPPriceError('Min price must be less than max price')
    }
  }, [usingDefaultPriceRange, minLPPriceDebounced, maxLPPriceDebounced, getTicksFromETHPrice])

  useAppEffect(() => {
    async function getDepositAmounts() {
      const result = await getMintAndLPDeposits(
        new BigNumber(ethToDepositDebounced),
        new BigNumber(collatRatioPercent),
        usingUniswapLPNFTAsCollat,
        lowerTick,
        upperTick,
      )
      if (!result) {
        return
      }

      const { ethInLP, ethInVault, effectiveCollateralInVault, oSQTHToMint, minCollatRatioPercent } = result
      const parsedCollatInVault = toTokenAmount(effectiveCollateralInVault, WETH_DECIMALS)

      if (parsedCollatInVault.lt(MIN_COLLATERAL_AMOUNT)) {
        setShowMinCollatError(true)
      } else {
        setShowMinCollatError(false)
      }

      setETHInLP(ethInLP)
      setETHInVault(ethInVault)
      setEffectiveCollateralInVault(effectiveCollateralInVault)
      setOSQTHToMint(oSQTHToMint)
      setMinCollatRatioPercent(minCollatRatioPercent.toNumber())
    }

    setLoadingDepositAmounts(true)
    getDepositAmounts().finally(() => setLoadingDepositAmounts(false))
  }, [ethToDepositDebounced, collatRatioPercent, lowerTick, upperTick, usingUniswapLPNFTAsCollat, getMintAndLPDeposits])

  useAppEffect(() => {
    async function getLiqPrice() {
      if (ethInVault.isZero() || oSQTHToMint.isZero() || ethInLP.isZero()) {
        return
      }

      const liqPrice = await getLiquidationPrice(
        ethInVault,
        oSQTHToMint,
        usingUniswapLPNFTAsCollat,
        lowerTick,
        upperTick,
      )
      if (!liqPrice) {
        return
      }
      setLiquidationPrice(liqPrice.toNumber())
    }

    getLiqPrice()
  }, [ethInVault, oSQTHToMint, ethInLP, lowerTick, upperTick, usingUniswapLPNFTAsCollat, getLiquidationPrice])

  const openPosition = useAppCallback(async () => {
    try {
      await openLPPosition(
        oSQTHToMint,
        ethInLP,
        ethInVault,
        lowerTick,
        upperTick,
        slippageAmount,
        () => {
          onConfirm()
        },
        () => {
          console.log('successfully deposited')
          onTxSuccess()
        },
      )
    } catch (error: unknown) {
      console.log('deposit failed', error)
      onTxFail(getErrorMessage(error))
    }
  }, [
    oSQTHToMint,
    ethInLP,
    ethInVault,
    lowerTick,
    upperTick,
    slippageAmount,
    openLPPosition,
    onConfirm,
    onTxSuccess,
    onTxFail,
  ])

  return (
    <>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography id="modal-title" variant="h2" className={classes.title}>
          Mint and LP Preview
        </Typography>

        <div className={classes.priceContainer}>
          <Typography
            className={clsx(
              typographyClasses.lightFontColor,
              typographyClasses.smallerFont,
              typographyClasses.monoFont,
            )}
          >{`1 ETH = ${ethPrice.isZero() ? 'loading...' : formatCurrency(ethPrice.toNumber())}`}</Typography>
        </div>
      </Box>

      <Box marginTop="32px">
        <Typography variant="h4" className={classes.sectionTitle}>
          Deposit amounts
        </Typography>

        <InputTokenDense
          value={ethToDeposit}
          onInputChange={setETHToDeposit}
          error={!!ethInputError}
          helperText={ethInputError}
          usdPrice={ethPrice}
          logo={ethLogo}
          symbol="ETH"
          balance={ethBalance}
          onBalanceClick={handleBalanceClick}
        />
      </Box>

      <Collapse in={showMinCollatError}>
        <Alert severity="error" marginTop="24px">
          Effective collateral in vault is {formatTokenAmount(effectiveCollateralInVault, WETH_DECIMALS)} ETH, which is
          less than the minimum 6.9 ETH limit.
        </Alert>
      </Collapse>

      <Divider className={classes.divider} />

      <div>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gridGap="8px">
            <div className={classes.logoContainer}>
              <div className={classes.logo}>
                <Image src={ethLogo} alt="logo" height="100%" width="100%" />
              </div>
            </div>

            <div>
              <Typography variant="h4" className={classes.sectionTitle}>
                Price range
              </Typography>
              <Typography
                className={clsx(
                  typographyClasses.lighterFontColor,
                  typographyClasses.smallestFont,
                  typographyClasses.monoFont,
                )}
              >{`1 ETH = ${ethPrice.isZero() ? 'loading...' : formatCurrency(ethPrice.toNumber())}`}</Typography>
            </div>
          </Box>

          <Checkbox
            isChecked={usingDefaultPriceRange}
            onChange={setUsingDefaultPriceRange}
            name="priceRangeDefault"
            label="Default"
          />
        </Box>

        <Box marginTop="24px" display="flex" justifyContent="space-between" alignItems="start" gridGap="20px">
          <InputNumber
            id="min-price"
            label="Min price"
            type="number"
            value={minLPPrice}
            onInputChange={setMinLPPrice}
            error={!!lpPriceError}
            helperText={lpPriceError}
            disabled={usingDefaultPriceRange}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Typography className={typographyClasses.lightestFontColor}>Per ETH</Typography>
                </InputAdornment>
              ),
            }}
          />

          <Box width="16px">
            <Divider className={classes.divider} />
          </Box>

          <InputNumber
            id="max-price"
            label="Max price"
            type="number"
            value={maxLPPrice}
            onInputChange={setMaxLPPrice}
            disabled={usingDefaultPriceRange}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <Typography className={typographyClasses.lightestFontColor}>Per ETH</Typography>
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </div>

      <Divider className={classes.divider} />

      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography className={typographyClasses.mediumBold}>Use Uniswap LP NFT as collateral</Typography>

        <ToggleButtonGroup
          size="medium"
          exclusive
          value={usingUniswapLPNFTAsCollat}
          onChange={(_, value) => handleUniswapNftAsCollatToggle(value)}
        >
          <ToggleButton classes={toggleButtonClasses} value={true}>
            Yes
          </ToggleButton>
          <ToggleButton classes={toggleButtonClasses} value={false}>
            No
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Collapse in={showUniswapLPNFTWarning}>
        <Alert severity="warning" marginTop="24px">
          Excluding your Uniswap NFT reduces the amount of capital that gets LP&apos;ed and earns interest for you.
        </Alert>
      </Collapse>

      <Divider className={classes.divider} />

      <div>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" className={classes.sectionTitle}>
            Collateralization ratio
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gridGap: '16px' }}>
            <Checkbox
              name="priceRangeDefault"
              label="Default"
              isChecked={usingDefaultCollatRatio}
              onChange={setUsingDefaultCollatRatio}
            />

            <InputNumber
              id="collateral-ratio-input"
              value={collatRatioPercent}
              onInputChange={handleCollatRatioPercentChange}
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

        <div style={{ marginTop: '24px' }}>
          <CollatRatioSlider
            collatRatio={collatRatioPercent}
            onCollatRatioChange={(value) => setCollatRatioPercent(value)}
            minCollatRatio={minCollatRatioPercent}
          />
        </div>
      </div>

      <InfoBox marginTop="24px">
        <Box display="flex" justifyContent="space-between" gridGap="12px">
          <Typography className={typographyClasses.lightFontColor}>Liquidation price</Typography>
          <Box display="flex" gridGap="8px">
            <Typography className={typographyClasses.monoFont}>{formatCurrency(liquidationPrice)}</Typography>
            <Typography className={typographyClasses.lightFontColor}>per ETH</Typography>
          </Box>
        </Box>
      </InfoBox>

      <Divider className={classes.divider} />

      <div>
        <InfoBox>
          <Box display="flex" justifyContent="space-between" gridGap="12px">
            <Typography className={typographyClasses.lightFontColor}>{"To be Minted & LP'ed"}</Typography>

            <Box display="flex" gridGap="8px">
              <Typography className={typographyClasses.monoFont}>
                {loadingDepositAmounts ? 'loading' : formatTokenAmount(oSQTHToMint, OSQUEETH_DECIMALS)}
              </Typography>
              <Typography className={typographyClasses.lightFontColor}>oSQTH</Typography>
            </Box>
          </Box>
        </InfoBox>

        <Box display="flex" justifyContent="space-between" gridGap="10px" marginTop="6px">
          <InfoBox>
            <Box display="flex" justifyContent="space-between" gridGap="12px">
              <Typography className={typographyClasses.lightFontColor}>{'To be LP’ed'}</Typography>

              <Box display="flex" gridGap="8px">
                <Typography className={typographyClasses.monoFont}>
                  {loadingDepositAmounts ? 'loading' : formatTokenAmount(ethInLP, WETH_DECIMALS)}
                </Typography>
                <Typography className={typographyClasses.lightFontColor}>ETH</Typography>
              </Box>
            </Box>
          </InfoBox>
          <InfoBox>
            <Box display="flex" justifyContent="space-between" gridGap="12px">
              <Typography className={typographyClasses.lightFontColor}>{'Vault'}</Typography>

              <Box display="flex" gridGap="8px">
                <Typography className={typographyClasses.monoFont}>
                  {loadingDepositAmounts ? 'loading' : formatTokenAmount(ethInVault, WETH_DECIMALS)}
                </Typography>
                <Typography className={typographyClasses.lightFontColor}>ETH</Typography>
              </Box>
            </Box>
          </InfoBox>
        </Box>

        <InfoBox marginTop="16px">
          <Box display="flex" justifyContent="center" gridGap="6px">
            <Typography>Total Deposit</Typography>
            <Typography className={typographyClasses.lightFontColor}>=</Typography>

            <Typography className={clsx(typographyClasses.lightFontColor, typographyClasses.monoFont)}>
              {loadingDepositAmounts ? 'loading' : formatTokenAmount(ethInLP.plus(ethInVault), WETH_DECIMALS)}
            </Typography>
            <Typography className={typographyClasses.lightFontColor}>ETH</Typography>
          </Box>
        </InfoBox>
      </div>

      <Box marginTop="32px">
        <AltPrimaryButton id="confirm-deposit-btn" onClick={openPosition} fullWidth>
          Confirm deposit
        </AltPrimaryButton>
      </Box>
    </>
  )
}

export default LPSettings

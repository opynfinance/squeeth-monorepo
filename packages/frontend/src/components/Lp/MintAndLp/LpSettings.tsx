import React, { useState, useCallback } from 'react'
import { Box, Typography, Divider, InputAdornment } from '@material-ui/core'
import { ToggleButtonGroup, ToggleButton } from '@material-ui/lab'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import { useAtomValue } from 'jotai'
import BigNumber from 'bignumber.js'
import { TickMath } from '@uniswap/v3-sdk'

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
import { BIG_ZERO, WETH_DECIMALS, OSQUEETH_DECIMALS } from '@constants/index'

import InfoBox from './InfoBox'
import TokenPrice from './TokenPrice'
import { TokenInputDense } from './Input'
import TokenLogo from './TokenLogo'
import Checkbox from './Checkbox'
import CollatRatioSlider from './CollatRatioSlider'
import { NumberInput } from './Input'
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
    lightFontColor: {
      color: 'rgba(255, 255, 255, 0.8)',
    },
  }),
)

const LpSettings: React.FC<{
  ethToDeposit: string
  setETHToDeposit: React.Dispatch<React.SetStateAction<string>>
  onConfirm: () => void
  onTxSuccess: () => void
  onTxFail: (message: string) => void
}> = ({ ethToDeposit, setETHToDeposit, onConfirm, onTxSuccess, onTxFail }) => {
  const [usingDefaultPriceRange, setUsingDefaultPriceRange] = useState(true)
  const [minETHLPPrice, setMinETHLPPrice] = useState('0')
  const [maxETHLPPrice, setMaxETHLPPrice] = useState('0')
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

  const { data: walletBalance } = useWalletBalance()
  const ethPrice = useETHPrice()
  const getTicksFromETHPrice = useGetTicksFromETHPrice()
  const getMintAndLPDeposits = useGetMintAndLPDeposits()
  const getLiquidationPrice = useGetLiquidationPrice()
  const openLPPosition = useOpenPositionDeposit()

  const slippageAmount = new BigNumber(slippageAmountPercent).div(100).toNumber()
  const ethBalance = toTokenAmount(walletBalance ?? BIG_ZERO, 18)

  const classes = useModalStyles()
  const toggleButtonClasses = useToggleButtonStyles()

  const handleBalanceClick = useCallback(
    () => setETHToDeposit(ethBalance.toFixed(4, BigNumber.ROUND_DOWN)),
    [ethBalance, setETHToDeposit],
  )

  const handleUniswapNftAsCollatToggle = useCallback((value: boolean | null) => {
    if (value !== null) {
      setUsingUniswapLPNFTAsCollat(value)
    }
  }, [])

  const handleCollatRatioPercentChange = useCallback((inputValue: string) => {
    setCollatRatioPercent(Number(inputValue))
  }, [])

  useAppEffect(() => {
    if (usingDefaultPriceRange) {
      setLowerTick(TickMath.MIN_TICK)
      setUpperTick(TickMath.MAX_TICK)
      return
    }

    const ticks = getTicksFromETHPrice(new BigNumber(minETHLPPrice), new BigNumber(maxETHLPPrice))
    setLowerTick(ticks.lowerTick)
    setUpperTick(ticks.upperTick)
  }, [usingDefaultPriceRange, minETHLPPrice, maxETHLPPrice, getTicksFromETHPrice])

  useAppEffect(() => {
    async function getDepositAmounts() {
      const result = await getMintAndLPDeposits(
        new BigNumber(ethToDeposit),
        new BigNumber(collatRatioPercent),
        usingUniswapLPNFTAsCollat,
        lowerTick,
        upperTick,
      )
      if (!result) {
        return
      }

      setETHInLP(result.ethInLP)
      setETHInVault(result.ethInVault)
      setEffectiveCollateralInVault(result.effectiveCollateralInVault)
      setOSQTHToMint(result.oSQTHToMint)
      setMinCollatRatioPercent(result.minCollatRatioPercent.toNumber())
    }

    setLoadingDepositAmounts(true)
    getDepositAmounts().finally(() => setLoadingDepositAmounts(false))
  }, [ethToDeposit, collatRatioPercent, lowerTick, upperTick, usingUniswapLPNFTAsCollat, getMintAndLPDeposits])

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
          <TokenPrice symbol="ETH" usdPrice={ethPrice} />
        </div>
      </Box>

      <Box marginTop="32px">
        <Typography variant="h4" className={classes.sectionTitle}>
          Deposit amounts
        </Typography>

        <TokenInputDense
          value={ethToDeposit}
          onInputChange={setETHToDeposit}
          usdPrice={ethPrice}
          logo={ethLogo}
          symbol="ETH"
          balance={ethBalance}
          onBalanceClick={handleBalanceClick}
        />
      </Box>

      <Box marginTop="32px" display="inline-block">
        <Typography variant="body2">
          Effective collateral in vault is {formatTokenAmount(effectiveCollateralInVault, WETH_DECIMALS)} ETH
        </Typography>
      </Box>

      <Divider className={classes.divider} />

      <div>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gridGap="8px">
            <TokenLogo logoSrc={ethLogo} />

            <div>
              <Typography variant="h4" className={classes.sectionTitle}>
                Price range
              </Typography>
              <TokenPrice symbol="ETH" usdPrice={ethPrice} isSmall />
            </div>
          </Box>

          <Checkbox
            isChecked={usingDefaultPriceRange}
            onChange={setUsingDefaultPriceRange}
            name="priceRangeDefault"
            label="Default"
          />
        </Box>

        <Box marginTop="24px" display="flex" justifyContent="space-between" alignItems="center" gridGap="20px">
          <NumberInput
            id="min-price"
            label="Min price"
            type="number"
            value={minETHLPPrice}
            onInputChange={setMinETHLPPrice}
            disabled={usingDefaultPriceRange}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end" style={{ opacity: '0.5' }}>
                  Per ETH
                </InputAdornment>
              ),
            }}
          />

          <Box sx={{ width: '16px' }}>
            <Divider className={classes.divider} />
          </Box>

          <NumberInput
            id="max-price"
            label="Max price"
            type="number"
            value={maxETHLPPrice}
            onInputChange={setMaxETHLPPrice}
            disabled={usingDefaultPriceRange}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end" style={{ opacity: '0.5' }}>
                  Per ETH
                </InputAdornment>
              ),
            }}
          />
        </Box>
      </div>

      <Divider className={classes.divider} />

      <div>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography style={{ fontWeight: 500 }}>Use Uniswap LP NFT as collateral</Typography>

          <ToggleButtonGroup
            size="medium"
            exclusive
            value={usingUniswapLPNFTAsCollat}
            onChange={(event, value) => handleUniswapNftAsCollatToggle(value)}
          >
            <ToggleButton classes={toggleButtonClasses} value={true}>
              Yes
            </ToggleButton>
            <ToggleButton classes={toggleButtonClasses} value={false}>
              No
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </div>

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

            <NumberInput
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
          <Typography className={classes.lightFontColor}>Liquidation price</Typography>
          <Box display="flex" gridGap="8px">
            <Typography>{formatCurrency(liquidationPrice)}</Typography>
            <Typography className={classes.lightFontColor}>per ETH</Typography>
          </Box>
        </Box>
      </InfoBox>

      <Divider className={classes.divider} />

      <div>
        <InfoBox>
          <Box display="flex" justifyContent="space-between" gridGap="12px">
            <Typography className={classes.lightFontColor}>{"To be Minted & LP'ed"}</Typography>

            <Box display="flex" gridGap="8px">
              <Typography>
                {loadingDepositAmounts ? 'loading' : formatTokenAmount(oSQTHToMint, OSQUEETH_DECIMALS)}
              </Typography>
              <Typography className={classes.lightFontColor}>oSQTH</Typography>
            </Box>
          </Box>
        </InfoBox>

        <Box display="flex" justifyContent="space-between" gridGap="10px" marginTop="6px">
          <InfoBox>
            <Box display="flex" justifyContent="space-between" gridGap="12px">
              <Typography className={classes.lightFontColor}>{'To be LP’ed'}</Typography>

              <Box display="flex" gridGap="8px">
                <Typography>{loadingDepositAmounts ? 'loading' : formatTokenAmount(ethInLP, WETH_DECIMALS)}</Typography>
                <Typography className={classes.lightFontColor}>ETH</Typography>
              </Box>
            </Box>
          </InfoBox>
          <InfoBox>
            <Box display="flex" justifyContent="space-between" gridGap="12px">
              <Typography className={classes.lightFontColor}>{'Vault'}</Typography>

              <Box display="flex" gridGap="8px">
                <Typography>
                  {loadingDepositAmounts ? 'loading' : formatTokenAmount(ethInVault, WETH_DECIMALS)}
                </Typography>
                <Typography className={classes.lightFontColor}>ETH</Typography>
              </Box>
            </Box>
          </InfoBox>
        </Box>

        <InfoBox marginTop="6px">
          <Box display="flex" justifyContent="center" gridGap="6px">
            <Typography>Total Deposit</Typography>
            <Typography className={classes.lightFontColor}>=</Typography>

            <Typography className={classes.lightFontColor}>
              {loadingDepositAmounts ? 'loading' : formatTokenAmount(ethInLP.plus(ethInVault), WETH_DECIMALS)}
            </Typography>
            <Typography className={classes.lightFontColor}>ETH</Typography>
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

export default LpSettings

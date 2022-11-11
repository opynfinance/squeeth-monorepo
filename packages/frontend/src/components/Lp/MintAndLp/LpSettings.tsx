import React, { useState } from 'react'
import { Box, Typography, Divider, InputAdornment } from '@material-ui/core'
import { ToggleButtonGroup, ToggleButton } from '@material-ui/lab'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import { useAtomValue } from 'jotai'
import BigNumber from 'bignumber.js'
import { TickMath } from '@uniswap/v3-sdk'

import { AltPrimaryButton } from '@components/Button'
import { useETHPrice } from '@hooks/useETHPrice'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import useAppCallback from '@hooks/useAppCallback'
import useAppEffect from '@hooks/useAppEffect'
import { addressesAtom } from '@state/positions/atoms'
import { useGetWSqueethPositionValue } from '@state/squeethPool/hooks'
import { useGetDepositAmounts, useGetTicksFromPriceRange, useOpenPositionDeposit } from '@state/lp/hooks'
import { slippageAmountAtom } from '@state/trade/atoms'
import { useWalletBalance } from '@state/wallet/hooks'
import { toTokenAmount } from '@utils/calculations'
import { formatNumber } from '@utils/formatter'
import { getErrorMessage } from '@utils/error'
import { OSQUEETH_DECIMALS, BIG_ZERO } from '@constants/index'

import InfoBox from './InfoBox'
import TokenPrice from './TokenPrice'
import TokenAmount from './TokenAmount'
import TokenLogo from './TokenLogo'
import Checkbox from './Checkbox'
import CollateralRatioSlider from './CollateralRatioSlider'
import { SimpleInput } from './Input'
import squeethLogo from 'public/images/squeeth-logo.svg'
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

const formatTokenAmount = (amount: string | number) => {
  const withPrecision = Number(toTokenAmount(amount, 18)).toPrecision(3)
  return Number(withPrecision).toFixed(2)
}

const LpSettings: React.FC<{
  ethToDeposit: string
  onConfirm: () => void
  onTxSuccess: () => void
  onTxFail: (message: string) => void
}> = ({ ethToDeposit, onConfirm, onTxSuccess, onTxFail }) => {
  const { data: walletBalance } = useWalletBalance()
  const ethPrice = useETHPrice()
  const getWSqueethPositionValue = useGetWSqueethPositionValue()
  const getTicksFromPriceRange = useGetTicksFromPriceRange()
  const getDepositAmounts = useGetDepositAmounts()
  const openLpPosition = useOpenPositionDeposit()
  const slippageAmount = useAtomValue(slippageAmountAtom)

  const [usingDefaultPriceRange, setUsingDefaultPriceRange] = useState(true)
  const [minPrice, setMinPrice] = useState('0')
  const [maxPrice, setMaxPrice] = useState('0')
  const [usingUniswapNftAsCollat, setUsingUniswapNftAsCollat] = useState(true)
  const [usingDefaultCollatRatio, setUsingDefaultCollatRatio] = useState(true)
  const [collatRatio, setCollatRatio] = useState(225)
  const [lowerTick, setLowerTick] = useState(TickMath.MIN_TICK)
  const [upperTick, setUpperTick] = useState(TickMath.MAX_TICK)

  const [depositInTotal, setDepositInTotal] = useState(0)
  const [depositInLp, setDepositInLp] = useState(0)
  const [depositInVault, setDepositInVault] = useState(0)
  const [loadingDepositAmounts, setLoadingDepositAmounts] = useState(false)

  const classes = useModalStyles()
  const toggleButtonClasses = useToggleButtonStyles()

  const squeethPrice = getWSqueethPositionValue(1)
  const collatRatioVal = new BigNumber(collatRatio).div(100).toNumber()
  const slippageAmountVal = new BigNumber(slippageAmount).div(100).toNumber()
  const ethBalance = toTokenAmount(walletBalance ?? BIG_ZERO, 18)

  const handleUniswapNftAsCollatToggle = (value: any) => {
    if (value !== null) {
      setUsingUniswapNftAsCollat(value)
    }
  }

  useAppEffect(() => {
    if (usingDefaultPriceRange) {
      setLowerTick(TickMath.MIN_TICK)
      setUpperTick(TickMath.MAX_TICK)
      return
    }

    const ticks = getTicksFromPriceRange(new BigNumber(minPrice), new BigNumber(maxPrice))
    setLowerTick(ticks.lowerTick)
    setUpperTick(ticks.upperTick)
  }, [usingDefaultPriceRange, minPrice, maxPrice, ethPrice, getTicksFromPriceRange])

  // useAppEffect(() => {
  //   async function calcDepositAmounts() {
  //     setLoadingDepositAmounts(true)
  //     const deposits = await getDepositAmounts(new BigNumber(squeethToMint), lowerTick, upperTick, 0, collatRatioVal, 0)
  //     if (deposits) {
  //       setDepositInLp(deposits.lpAmount.toNumber())
  //       setDepositInVault(deposits.mintAmount.toNumber())
  //       setDepositInTotal(deposits.totalAmount.toNumber())
  //     }
  //     setLoadingDepositAmounts(false)
  //   }

  //   calcDepositAmounts()
  // }, [squeethToMint, lowerTick, upperTick, collatRatioVal, getDepositAmounts])

  // const openPosition = useAppCallback(async () => {
  //   try {
  //     await openLpPosition(
  //       new BigNumber(squeethToMint),
  //       lowerTick,
  //       upperTick,
  //       0,
  //       collatRatioVal,
  //       slippageAmountVal,
  //       0,
  //       () => {
  //         onConfirm()
  //       },
  //       () => {
  //         console.log('successfully deposited')
  //         onTxSuccess()
  //       },
  //     )
  //   } catch (error: unknown) {
  //     console.log('deposit failed', error)
  //     onTxFail(getErrorMessage(error))
  //   }
  // }, [
  //   squeethToMint,
  //   lowerTick,
  //   upperTick,
  //   collatRatioVal,
  //   slippageAmountVal,
  //   openLpPosition,
  //   onConfirm,
  //   onTxSuccess,
  //   onTxFail,
  // ])

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

        <TokenAmount amount={ethToDeposit} usdPrice={ethPrice} logo={ethLogo} symbol="ETH" balance={ethBalance} />
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
          <SimpleInput
            id="min-price"
            label="Min price"
            value={isNaN(Number(minPrice)) ? 0 : minPrice}
            onInputChange={setMinPrice}
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

          <SimpleInput
            id="max-price"
            label="Max price"
            value={isNaN(Number(maxPrice)) ? 0 : maxPrice}
            onInputChange={setMaxPrice}
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
            value={usingUniswapNftAsCollat}
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

            <SimpleInput
              id="collateral-ratio-input"
              value={collatRatio}
              onInputChange={(value) => setCollatRatio(Number(value))}
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
          <CollateralRatioSlider collateralRatio={collatRatio} onCollateralRatioChange={(val) => setCollatRatio(val)} />
        </div>
      </div>

      <InfoBox marginTop="24px">
        <Box display="flex" justifyContent="space-between" gridGap="12px">
          <Typography className={classes.lightFontColor}>Liquidation price</Typography>
          <Box display="flex" gridGap="8px">
            <Typography>$3,018.29</Typography>
            <Typography className={classes.lightFontColor}>per ETH</Typography>
          </Box>
        </Box>
      </InfoBox>

      <InfoBox marginTop="6px">
        <Box display="flex" justifyContent="space-between" gridGap="12px">
          <Typography className={classes.lightFontColor}>Projected APY</Typography>
          <Typography>26.08 %</Typography>
        </Box>
      </InfoBox>

      <Divider className={classes.divider} />

      <div>
        <InfoBox>
          <Box display="flex" justifyContent="center" gridGap="6px">
            <Typography>Total Deposit</Typography>
            <Typography className={classes.lightFontColor}>=</Typography>

            <Typography className={classes.lightFontColor}>
              {loadingDepositAmounts ? 'loading' : formatTokenAmount(depositInTotal)}
            </Typography>
            <Typography className={classes.lightFontColor}>ETH</Typography>
          </Box>
        </InfoBox>

        <Box display="flex" justifyContent="space-between" gridGap="10px" marginTop="6px">
          <InfoBox>
            <Box display="flex" justifyContent="space-between" gridGap="12px">
              <Typography className={classes.lightFontColor}>{'To be LP’ed'}</Typography>

              <Box display="flex" gridGap="8px">
                <Typography> {loadingDepositAmounts ? 'loading' : formatTokenAmount(depositInLp)}</Typography>
                <Typography className={classes.lightFontColor}>ETH</Typography>
              </Box>
            </Box>
          </InfoBox>
          <InfoBox>
            <Box display="flex" justifyContent="space-between" gridGap="12px">
              <Typography className={classes.lightFontColor}>{'Vault'}</Typography>

              <Box display="flex" gridGap="8px">
                <Typography>{loadingDepositAmounts ? 'loading' : formatTokenAmount(depositInVault)}</Typography>
                <Typography className={classes.lightFontColor}>ETH</Typography>
              </Box>
            </Box>
          </InfoBox>
        </Box>
      </div>

      <Box marginTop="32px">
        <AltPrimaryButton id="confirm-deposit-btn" onClick={() => {}} fullWidth>
          Confirm deposit
        </AltPrimaryButton>
      </Box>
    </>
  )
}

export default LpSettings

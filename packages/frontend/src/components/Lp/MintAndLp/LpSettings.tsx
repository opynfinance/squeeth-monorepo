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
import { toTokenAmount } from '@utils/calculations'
import { formatNumber } from '@utils/formatter'
import { OSQUEETH_DECIMALS } from '@constants/index'

import InfoBox from './InfoBox'
import TokenPrice from './TokenPrice'
import TokenAmount from './TokenAmount'
import TokenLogo from './TokenLogo'
import Checkbox from './Checkbox'
import CollateralRatioSlider from './CollateralRatioSlider'
import { SimpleInput } from './Input'
import squeethLogo from 'public/images/squeeth-logo.svg'

const useTextStyles = makeStyles({
  light: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
})

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
    titleSection: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalTitle: {
      fontSize: '24px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    priceContainer: {
      backgroundColor: theme.palette.background.lightStone,
      padding: theme.spacing(0.75, 1.5),
      borderRadius: '8px',
    },

    subSection: {},
    priceRangeSectionHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    priceRangeSectionHeaderLeftColumn: {
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    },
    sectionTitle: {
      fontSize: '18px',
      fontWeight: 700,
    },
    divider: {
      height: '2px',
      backgroundColor: theme.palette.background.lightStone,
      margin: theme.spacing(4, 0),
      display: 'inline-block',
      width: '100%',
    },
    priceRangeSection: {
      marginTop: theme.spacing(3),
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: theme.spacing(2),
    },
  }),
)

const formatTokenAmount = (amount: string | number) => {
  const withPrecision = Number(toTokenAmount(amount, 18)).toPrecision(3)
  return Number(withPrecision).toFixed(2)
}

const LpSettings: React.FC<{ onComplete: () => void; squeethToMint: string }> = ({ onComplete, squeethToMint }) => {
  const { oSqueeth } = useAtomValue(addressesAtom)
  const { value: squeethBalance } = useTokenBalance(oSqueeth, 15, OSQUEETH_DECIMALS)
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
  const textClasses = useTextStyles()

  const squeethPrice = getWSqueethPositionValue(1)
  const collatRatioVal = new BigNumber(collatRatio).div(100).toNumber()
  const slippageAmountVal = new BigNumber(slippageAmount).div(100).toNumber()

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

  useAppEffect(() => {
    async function calcDepositAmounts() {
      setLoadingDepositAmounts(true)
      const deposits = await getDepositAmounts(new BigNumber(squeethToMint), lowerTick, upperTick, 0, collatRatioVal, 0)
      if (deposits) {
        setDepositInLp(deposits.lpAmount.toNumber())
        setDepositInVault(deposits.mintAmount.toNumber())
        setDepositInTotal(deposits.totalAmount.toNumber())
      }
      setLoadingDepositAmounts(false)
    }

    calcDepositAmounts()
  }, [squeethToMint, lowerTick, upperTick, collatRatioVal, getDepositAmounts])

  const openPosition = useAppCallback(async () => {
    try {
      await openLpPosition(
        new BigNumber(squeethToMint),
        lowerTick,
        upperTick,
        0,
        collatRatioVal,
        slippageAmountVal,
        0,
        () => {
          console.log('successfully deposited')
          onComplete()
        },
      )
    } catch (e) {
      console.log('transaction failed')
      console.log(e)
    }
  }, [squeethToMint, lowerTick, upperTick, collatRatioVal, slippageAmountVal, openLpPosition, onComplete])

  return (
    <>
      <div className={classes.titleSection}>
        <Typography id="modal-title" variant="h2" className={classes.modalTitle}>
          Mint and LP Preview
        </Typography>

        <div className={classes.priceContainer}>
          <TokenPrice symbol="ETH" price={formatNumber(Number(ethPrice))} />
        </div>
      </div>

      <Box className={classes.subSection} marginTop="32px">
        <Typography variant="h4" className={classes.sectionTitle}>
          Mint amounts
        </Typography>

        <TokenAmount
          amount={squeethToMint}
          price={squeethPrice.toString()}
          logo={squeethLogo}
          symbol="oSQTH"
          balance={squeethBalance.toString()}
        />
      </Box>

      <Divider className={classes.divider} />

      <div className={classes.subSection}>
        <div className={classes.priceRangeSectionHeader}>
          <div className={classes.priceRangeSectionHeaderLeftColumn}>
            <TokenLogo logoSrc={squeethLogo} />

            <div>
              <Typography variant="h4" className={classes.sectionTitle}>
                Price range
              </Typography>
              <TokenPrice symbol="oSQTH" price={formatNumber(squeethPrice.toNumber())} isSmall />
            </div>
          </div>

          <Checkbox
            isChecked={usingDefaultPriceRange}
            onChange={setUsingDefaultPriceRange}
            name="priceRangeDefault"
            label="Default"
          />
        </div>

        <div className={classes.priceRangeSection}>
          <SimpleInput
            id="min-price"
            label="Min price"
            value={isNaN(Number(minPrice)) ? 0 : minPrice}
            onInputChange={setMinPrice}
            disabled={usingDefaultPriceRange}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end" style={{ opacity: '0.5' }}>
                  Per oSQTH
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
                  Per oSQTH
                </InputAdornment>
              ),
            }}
          />
        </div>
      </div>

      <Divider className={classes.divider} />

      <div className={classes.subSection}>
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

      <div className={classes.subSection}>
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
          <Typography className={textClasses.light}>Liquidation price</Typography>
          <Box display="flex" gridGap="8px">
            <Typography>$3,018.29</Typography>
            <Typography className={textClasses.light}>per ETH</Typography>
          </Box>
        </Box>
      </InfoBox>

      <InfoBox marginTop="6px">
        <Box display="flex" justifyContent="space-between" gridGap="12px">
          <Typography className={textClasses.light}>Projected APY</Typography>
          <Typography>26.08 %</Typography>
        </Box>
      </InfoBox>

      <Divider className={classes.divider} />

      <div className={classes.subSection}>
        <InfoBox>
          <Box display="flex" justifyContent="center" gridGap="6px">
            <Typography>Total Deposit</Typography>
            <Typography className={textClasses.light}>=</Typography>

            <Typography className={textClasses.light}>
              {loadingDepositAmounts ? 'loading' : formatTokenAmount(depositInTotal)}
            </Typography>
            <Typography className={textClasses.light}>ETH</Typography>
          </Box>
        </InfoBox>

        <Box display="flex" justifyContent="space-between" gridGap="10px" marginTop="6px">
          <InfoBox>
            <Box display="flex" justifyContent="space-between" gridGap="12px">
              <Typography className={textClasses.light}>{'To be LP’ed'}</Typography>

              <Box display="flex" gridGap="8px">
                <Typography> {loadingDepositAmounts ? 'loading' : formatTokenAmount(depositInLp)}</Typography>
                <Typography className={textClasses.light}>ETH</Typography>
              </Box>
            </Box>
          </InfoBox>
          <InfoBox>
            <Box display="flex" justifyContent="space-between" gridGap="12px">
              <Typography className={textClasses.light}>{'Vault'}</Typography>

              <Box display="flex" gridGap="8px">
                <Typography>{loadingDepositAmounts ? 'loading' : formatTokenAmount(depositInVault)}</Typography>
                <Typography className={textClasses.light}>ETH</Typography>
              </Box>
            </Box>
          </InfoBox>
        </Box>
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

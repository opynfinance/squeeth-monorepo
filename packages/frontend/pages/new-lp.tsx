import Nav from '@components/Nav'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import {
  Grid,
  Typography,
  Box,
  Modal,
  Divider,
  Checkbox,
  FormControlLabel,
  InputAdornment,
  TextField,
  BoxProps,
} from '@material-ui/core'
import { ToggleButtonGroup, ToggleButton } from '@material-ui/lab'
import React, { useState } from 'react'
import { ThemeProvider } from '@material-ui/core/styles'
import { PrimaryButton } from '@components/Button'
import Image from 'next/image'

import CollateralRatioSlider from '@components/Lp/CollateralRatioSlider'
import getTheme, { Mode } from '../src/theme'
import ethLogo from '../public/images/eth-logo.svg'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(5, 10),
      maxWidth: '1500px',
      width: '95%',
      marginLeft: 'auto',
      marginRight: 'auto',
    },
    sectionHeader: {
      fontSize: theme.typography.pxToRem(18),
      fontWeight: 700,
      marginBottom: theme.spacing(1),
    },
    depositBtn: {
      fontWeight: 700,
      textTransform: 'initial',
      width: '100%',
      marginTop: theme.spacing(4),
    },
  }),
)

const useInputStyles = makeStyles((theme) =>
  createStyles({
    container: {
      backgroundColor: 'inherit',
      textAlign: 'left',
      position: 'relative',
      marginBottom: '44px',
      zIndex: 0,
    },
    inputContainer: {
      display: 'flex',
      justifyContent: 'space-between',
      border: `2px solid ${theme.palette.background.lightStone}`,
      borderRadius: '10px',
      padding: theme.spacing(2),
      marginTop: '1em',
      backgroundColor: theme.palette.background.default,
    },
    leftInputContainer: {},
    input: {
      display: 'inline-block',
      border: 'none',
      backgroundColor: 'inherit',
      outline: 'none',
      fontSize: '22px',
      width: '204px',

      color: theme.palette.text.primary,
      fontWeight: theme.typography.fontWeightBold,
      fontFamily: theme.typography.fontFamily,
    },
    unitsContainer: {},
    rightInputContainer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0px 10px',
      height: '28px',
      backgroundColor: theme.palette.background.stone,

      borderRadius: '6px',
    },
    tokenLogoContainer: {
      width: '16px',
      height: '16px',
      marginRight: theme.spacing(0.5),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tokenLogo: {
      height: '19px',
      width: '11px',
    },
    tokenSymbol: {
      opacity: 0.5,
      fontWeight: 500,
    },
    tokenBalanceContainer: {
      position: 'absolute',
      right: '0',
      left: '0',
      bottom: '-44px',
      zIndex: -10,
      display: 'flex',
      justifyContent: 'space-between',
      padding: '36px 16px 12px 16px',

      backgroundColor: theme.palette.background.stone,
      borderRadius: '10px',
    },
    tokenBalanceLabel: {
      opacity: 0.5,
    },
  }),
)

type TokenInputType = {
  id?: string
  value: string
  onChange: (value: string) => void
  tokenPrice: string
  tokenSymbol: string
  tokenLogo: string
  tokenBalance: string
}

const TokenInput: React.FC<TokenInputType> = ({
  id,
  value,
  onChange,
  tokenPrice,
  tokenSymbol,
  tokenLogo,
  tokenBalance,
}) => {
  const classes = useInputStyles()

  const handleChange = (inputValue: string) => {
    onChange(inputValue)
  }

  return (
    <div className={classes.container}>
      <div className={classes.inputContainer}>
        <div className={classes.leftInputContainer}>
          <input
            id={id}
            className={classes.input}
            value={value}
            onChange={(event) => handleChange(event.target.value)}
            onWheel={(e) => (e.target as any).blur()}
            placeholder="0"
            type="number"
            min="0"
          />
          <div className={classes.unitsContainer}>
            <Typography variant="caption">${tokenPrice ? parseInt(value) * parseInt(tokenPrice) : 0}</Typography>
          </div>
        </div>
        <div className={classes.rightInputContainer}>
          <div className={classes.tokenLogoContainer}>
            <div className={classes.tokenLogo}>
              <Image src={tokenLogo} alt="logo" />
            </div>
          </div>

          <span className={classes.tokenSymbol}>{tokenSymbol}</span>
        </div>
      </div>

      <div className={classes.tokenBalanceContainer}>
        <Typography variant="caption" className={classes.tokenBalanceLabel}>
          Available
        </Typography>
        <Typography variant="caption">
          {tokenBalance} {tokenSymbol}
        </Typography>
      </div>
    </div>
  )
}

const useTokenDepositStyles = makeStyles((theme) =>
  createStyles({
    container: {
      backgroundColor: 'inherit',
      textAlign: 'left',
      position: 'relative',
      marginBottom: '42px',
      width: '50%',
      zIndex: 0,
    },

    mainSection: {
      display: 'flex',
      alignItems: 'center',
      border: `2px solid ${theme.palette.background.lightStone}`,
      borderRadius: '10px',
      padding: theme.spacing(2),
      marginTop: '1em',
      backgroundColor: theme.palette.background.default,
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
      height: '24px',
      width: '14px',
    },
    depositContainer: {
      marginLeft: theme.spacing(1),
    },
    amountContainer: {
      display: 'flex',
    },
    amount: {
      fontWeight: 500,
    },
    symbol: {
      opacity: 0.5,
      fontWeight: 400,
      marginLeft: theme.spacing(0.5),
    },
    usdValue: {
      opacity: 0.5,
      fontWeight: 400,
    },
    subSection: {
      position: 'absolute',
      right: '0',
      left: '0',
      bottom: '-42px',
      zIndex: -10,
      display: 'flex',
      justifyContent: 'space-between',
      padding: '36px 16px 12px 16px',
      backgroundColor: theme.palette.background.stone,
      borderRadius: '10px',
    },
    tokenBalanceLabel: {
      opacity: 0.5,
    },
  }),
)

const useTokenLogoStyles = makeStyles((theme) =>
  createStyles({
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
      height: '24px',
      width: '14px',
    },
  }),
)

const TokenLogo: React.FC<{ logoSrc: string }> = ({ logoSrc }) => {
  const classes = useTokenLogoStyles()

  return (
    <div className={classes.logoContainer}>
      <div className={classes.logo}>
        <Image src={logoSrc} alt="logo" />
      </div>
    </div>
  )
}

type TokenDepositType = {
  amount: string
  tokenPrice: string
  tokenSymbol: string
  tokenLogo: string
  tokenBalance: string
}

const TokenDeposit: React.FC<TokenDepositType> = ({ amount, tokenPrice, tokenSymbol, tokenLogo, tokenBalance }) => {
  const classes = useTokenDepositStyles()

  return (
    <div className={classes.container}>
      <div className={classes.mainSection}>
        <TokenLogo logoSrc={tokenLogo} />
        <div className={classes.depositContainer}>
          <div className={classes.amountContainer}>
            <Typography className={classes.amount}>{amount}</Typography>
            <Typography className={classes.symbol}>{tokenSymbol}</Typography>
          </div>

          <Typography variant="caption" className={classes.usdValue}>
            ${tokenPrice ? parseInt(amount) * parseInt(tokenPrice) : 0}
          </Typography>
        </div>
      </div>

      <div className={classes.subSection}>
        <Typography variant="caption" className={classes.tokenBalanceLabel}>
          Available
        </Typography>
        <Typography variant="caption">
          {tokenBalance} {tokenSymbol}
        </Typography>
      </div>
    </div>
  )
}

type TokenPriceStyleProps = {
  fontSize: string
  color: string
}

const useTokenPriceStyles = makeStyles((theme) =>
  createStyles({
    priceContainer: {
      display: 'flex',
      gap: theme.spacing(1),
    },
    priceText: (props: TokenPriceStyleProps) => ({
      fontSize: props.fontSize,
      color: props.color,
    }),
  }),
)

const TokenPrice: React.FC<{ symbol: string; price: string; styleProps?: TokenPriceStyleProps }> = ({
  symbol,
  price,
  styleProps = { fontSize: '14px', color: 'rgba(255, 255, 255)' },
}) => {
  const classes = useTokenPriceStyles(styleProps)

  return (
    <div className={classes.priceContainer}>
      <Typography className={classes.priceText}>{`1 ${symbol}`}</Typography>
      <Typography className={classes.priceText}>{'='}</Typography>
      <Typography className={classes.priceText}>{`$${price}`}</Typography>
    </div>
  )
}

const useModalStyles = makeStyles((theme) =>
  createStyles({
    container: {
      margin: '5em auto 0px',
      width: '80%',
      maxWidth: '640px',
      background: theme.palette.background.default,
      padding: theme.spacing(6),
      borderRadius: 20,
      overflow: 'scroll',
      height: '90%',
      display: 'block',
    },
    titleSection: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalTitle: {
      fontSize: theme.typography.pxToRem(20),
      fontWeight: 700,
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
      fontSize: theme.typography.pxToRem(18),
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

const useCheckboxStyles = makeStyles((theme) =>
  createStyles({
    root: {
      padding: 0,
      marginRight: theme.spacing(0.5),
    },
  }),
)

const useFormControlLabelStyles = makeStyles({
  root: {
    marginRight: 0,
  },
  label: {
    fontWeight: 500,
  },
})

const useSimpleInputStyles = makeStyles((theme) =>
  createStyles({
    label: {
      opacity: 0.5,
      '& ~ $input': {
        marginTop: '24px',
      },
    },
    labelFocused: {
      color: theme.palette.primary.main,
      opacity: 0.8,
    },
    input: {
      padding: theme.spacing(0.75, 1.5),
      border: '2px solid',
      borderColor: theme.palette.background.lightStone,
      borderRadius: '12px',
      fontSize: '14px',
    },
    inputFocused: {
      borderColor: theme.palette.primary.main,
    },
  }),
)

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

const useTextStyles = makeStyles({
  light: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
})

const useButtonStyles = makeStyles({
  primary: {
    textTransform: 'initial',
    fontWeight: 700,
  },
})

const useStatsBoxStyles = makeStyles((theme) =>
  createStyles({
    container: {
      backgroundColor: theme.palette.background.stone,
      borderRadius: '12px',
      padding: theme.spacing(2, 2.5),
      width: '100%',
    },
  }),
)

const StatsBox: React.FC<BoxProps> = (props) => {
  const classes = useStatsBoxStyles()
  return <Box className={classes.container} {...props} />
}

type PreviewModalType = {
  isOpen: boolean
  onClose: () => void
}

const PreviewModal: React.FC<PreviewModalType> = ({ isOpen, onClose }) => {
  const [useDefaultPriceChange, setUseDefaultPriceRange] = useState(false)
  const [useUniswapNftAsCollateral, setUseUniswapNftAsCollateral] = useState(true)
  const [useDefaultCollateralRatio, setUseDefaultCollateralRatio] = useState(true)
  const [collateralRatio, setCollateralRatio] = useState(225)

  const classes = useModalStyles()
  const checkboxClasses = useCheckboxStyles()
  const formControlLabelClasses = useFormControlLabelStyles()
  const inputClasses = useSimpleInputStyles()
  const toggleButtonClasses = useToggleButtonStyles()
  const textClasses = useTextStyles()
  const buttonClasses = useButtonStyles()

  return (
    <Modal open={isOpen} onClose={onClose} aria-labelledby="modal-title">
      <Box className={classes.container}>
        <div className={classes.titleSection}>
          <Typography id="modal-title" variant="h2" className={classes.modalTitle}>
            Mint and LP Preview
          </Typography>

          <div className={classes.priceContainer}>
            <TokenPrice
              symbol={'ETH'}
              price="2108.10"
              styleProps={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px' }}
            />
          </div>
        </div>

        <div className={classes.subSection} style={{ marginTop: '32px' }}>
          <Typography variant="h4" className={classes.sectionTitle}>
            Deposit amounts
          </Typography>

          <TokenDeposit amount="43" tokenPrice="2108.10" tokenLogo={ethLogo} tokenSymbol="ETH" tokenBalance="12.34" />
        </div>

        <Divider className={classes.divider} />

        <div className={classes.subSection}>
          <div className={classes.priceRangeSectionHeader}>
            <div className={classes.priceRangeSectionHeaderLeftColumn}>
              <TokenLogo logoSrc={ethLogo} />

              <div>
                <Typography variant="h4" className={classes.sectionTitle}>
                  Price range
                </Typography>
                <TokenPrice
                  symbol="ETH"
                  price="2108.10"
                  styleProps={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}
                />
              </div>
            </div>

            <FormControlLabel
              classes={formControlLabelClasses}
              control={
                <Checkbox
                  className={checkboxClasses.root}
                  checked={useDefaultPriceChange}
                  onChange={(event) => setUseDefaultPriceRange(event.target.checked)}
                  name="priceRangeDefault"
                  color="primary"
                />
              }
              label="Default"
            />
          </div>

          <div className={classes.priceRangeSection}>
            <TextField
              label="Min price"
              id="min-price-eth"
              value={'0'}
              onChange={() => {}}
              InputLabelProps={{
                classes: {
                  root: inputClasses.label,
                  focused: inputClasses.labelFocused,
                },
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end" style={{ opacity: '0.5' }}>
                    Per ETH
                  </InputAdornment>
                ),
                disableUnderline: true,
                classes: {
                  root: inputClasses.input,
                  focused: inputClasses.inputFocused,
                },
              }}
            />

            <Box sx={{ width: '16px' }}>
              <Divider className={classes.divider} />
            </Box>

            <TextField
              label="Max price"
              id="max-price-eth"
              value={'0'}
              onChange={() => {}}
              InputLabelProps={{
                classes: {
                  root: inputClasses.label,
                  focused: inputClasses.labelFocused,
                },
              }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end" style={{ opacity: '0.5' }}>
                    Per ETH
                  </InputAdornment>
                ),
                disableUnderline: true,
                classes: {
                  root: inputClasses.input,
                  focused: inputClasses.inputFocused,
                },
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
              value={useUniswapNftAsCollateral}
              onChange={(e, value) => setUseUniswapNftAsCollateral(value)}
              exclusive
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
              <FormControlLabel
                classes={formControlLabelClasses}
                control={
                  <Checkbox
                    className={checkboxClasses.root}
                    checked={useDefaultCollateralRatio}
                    onChange={(event) => setUseDefaultCollateralRatio(event.target.checked)}
                    name="priceRangeDefault"
                    color="primary"
                  />
                }
                label="Default"
              />

              <TextField
                id="collateral-ratio-input"
                value={collateralRatio}
                onChange={(event) => setCollateralRatio(parseInt(event.target.value))}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end" style={{ opacity: '0.5' }}>
                      %
                    </InputAdornment>
                  ),
                  disableUnderline: true,
                  classes: {
                    root: inputClasses.input,
                    focused: inputClasses.inputFocused,
                  },
                }}
                style={{ width: '80px' }}
              />
            </Box>
          </Box>

          <div style={{ marginTop: '24px' }}>
            <CollateralRatioSlider
              collateralRatio={collateralRatio}
              onCollateralRatioChange={(val) => setCollateralRatio(val)}
            />
          </div>
        </div>

        <StatsBox marginTop="24px">
          <Box display="flex" justifyContent="space-between" gridGap="12px">
            <Typography className={textClasses.light}>Liquidation price</Typography>
            <Box display="flex" gridGap="8px">
              <Typography>$3,018.29</Typography>
              <Typography className={textClasses.light}>per ETH</Typography>
            </Box>
          </Box>
        </StatsBox>

        <StatsBox marginTop="6px">
          <Box display="flex" justifyContent="space-between" gridGap="12px">
            <Typography className={textClasses.light}>Projected APY</Typography>
            <Typography>26.08 %</Typography>
          </Box>
        </StatsBox>

        <Divider className={classes.divider} />

        <div className={classes.subSection}>
          <StatsBox>
            <Box display="flex" justifyContent="center" gridGap="6px">
              <Typography>Total Deposit</Typography>
              <Typography className={textClasses.light}>= 126.5 ETH (including 186 oSQTH)</Typography>
            </Box>
          </StatsBox>

          <Box display="flex" justifyContent="space-between" gridGap="10px" marginTop="6px">
            <StatsBox>
              <Box display="flex" justifyContent="space-between" gridGap="12px">
                <Typography className={textClasses.light}>{'To be LP’ed'}</Typography>

                <Box display="flex" gridGap="8px">
                  <Typography>94.2</Typography>
                  <Typography className={textClasses.light}>ETH</Typography>
                </Box>
              </Box>
            </StatsBox>
            <StatsBox>
              <Box display="flex" justifyContent="space-between" gridGap="12px">
                <Typography className={textClasses.light}>{'Vault'}</Typography>

                <Box display="flex" gridGap="8px">
                  <Typography>32.3</Typography>
                  <Typography className={textClasses.light}>ETH</Typography>
                </Box>
              </Box>
            </StatsBox>
          </Box>
        </div>

        <Box marginTop="32px">
          <PrimaryButton
            id="confirm-deposit-btn"
            variant="contained"
            fullWidth={true}
            className={buttonClasses.primary}
            onClick={() => {}}
          >
            {'Confirm deposit'}
          </PrimaryButton>
        </Box>
      </Box>
    </Modal>
  )
}

const LPPage: React.FC = () => {
  const classes = useStyles()
  const [ethAmount, setEthAmount] = useState('0')
  const [isPreviewModalOpen, setPreviewModalOpen] = useState(false)

  return (
    <>
      <Nav />

      <Grid container spacing={10} justifyContent="center" className={classes.container}>
        <Grid item xs={12} md={8}>
          <Typography variant="subtitle1" className={classes.sectionHeader}>
            Pool returns
          </Typography>
        </Grid>
        <Grid item xs md>
          <Box>
            <Typography className={classes.sectionHeader} variant="subtitle1">
              Deposit tokens
            </Typography>

            <TokenInput
              id="eth-amount-input"
              value={ethAmount}
              onChange={(value) => setEthAmount(value)}
              tokenPrice="1500"
              tokenLogo={ethLogo}
              tokenSymbol="ETH"
              tokenBalance="12.34"
            />

            <PrimaryButton
              id="deposit-and-mint-btn"
              variant="contained"
              className={classes.depositBtn}
              onClick={() => setPreviewModalOpen(true)}
            >
              {'Preview deposit'}
            </PrimaryButton>
          </Box>
        </Grid>
      </Grid>

      <PreviewModal isOpen={isPreviewModalOpen} onClose={() => setPreviewModalOpen(false)} />
    </>
  )
}

const ThemeWrapper: React.FC = () => (
  <ThemeProvider theme={getTheme(Mode.NEW_DARK)}>
    <LPPage />
  </ThemeProvider>
)

export default ThemeWrapper

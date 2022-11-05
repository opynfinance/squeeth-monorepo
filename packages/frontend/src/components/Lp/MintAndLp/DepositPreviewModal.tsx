import React, { useState } from 'react'
import { Modal, Box, Typography, Divider, InputAdornment, Stepper, Step, StepLabel } from '@material-ui/core'
import { ToggleButtonGroup, ToggleButton } from '@material-ui/lab'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import Image from 'next/image'
import clsx from 'clsx'

import { AltPrimaryButton } from '@components/Button'
import ethLogo from 'public/images/eth-logo.svg'
import sqthLogo from 'public/images/squeeth-logo.svg'
import walletIcon from 'public/images/wallet.svg'
import InfoBox from './InfoBox'
import TokenPrice from './TokenPrice'
import TokenDeposit from './TokenDeposit'
import TokenLogo from './TokenLogo'
import Checkbox from './Checkbox'
import CollateralRatioSlider from './CollateralRatioSlider'
import { SimpleInput } from './Input'

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

const LPSettings: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [useDefaultPriceChange, setUseDefaultPriceRange] = useState(false)
  const [useUniswapNftAsCollateral, setUseUniswapNftAsCollateral] = useState(true)
  const [useDefaultCollateralRatio, setUseDefaultCollateralRatio] = useState(true)
  const [collateralRatio, setCollateralRatio] = useState(225)

  const classes = useModalStyles()
  const toggleButtonClasses = useToggleButtonStyles()
  const textClasses = useTextStyles()

  return (
    <>
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
            <TokenLogo logoSrc={sqthLogo} />

            <div>
              <Typography variant="h4" className={classes.sectionTitle}>
                Price range
              </Typography>
              <TokenPrice
                symbol="oSQTH"
                price="70"
                styleProps={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}
              />
            </div>
          </div>

          <Checkbox
            isChecked={useDefaultPriceChange}
            onChange={setUseDefaultPriceRange}
            name="priceRangeDefault"
            label="Default"
          />
        </div>

        <div className={classes.priceRangeSection}>
          <SimpleInput
            id="min-price"
            label="Min price"
            value="0"
            onChange={() => {}}
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
            value="0"
            onChange={() => {}}
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
            <Checkbox
              name="priceRangeDefault"
              label="Default"
              isChecked={useDefaultCollateralRatio}
              onChange={setUseDefaultCollateralRatio}
            />

            <SimpleInput
              id="collateral-ratio-input"
              value={collateralRatio}
              onChange={(value) => setCollateralRatio(Number(value))}
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
          <CollateralRatioSlider
            collateralRatio={collateralRatio}
            onCollateralRatioChange={(val) => setCollateralRatio(val)}
          />
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
            <Typography className={textClasses.light}>= 126.5 ETH (including 186 oSQTH)</Typography>
          </Box>
        </InfoBox>

        <Box display="flex" justifyContent="space-between" gridGap="10px" marginTop="6px">
          <InfoBox>
            <Box display="flex" justifyContent="space-between" gridGap="12px">
              <Typography className={textClasses.light}>{'To be LP’ed'}</Typography>

              <Box display="flex" gridGap="8px">
                <Typography>94.2</Typography>
                <Typography className={textClasses.light}>ETH</Typography>
              </Box>
            </Box>
          </InfoBox>
          <InfoBox>
            <Box display="flex" justifyContent="space-between" gridGap="12px">
              <Typography className={textClasses.light}>{'Vault'}</Typography>

              <Box display="flex" gridGap="8px">
                <Typography>32.3</Typography>
                <Typography className={textClasses.light}>ETH</Typography>
              </Box>
            </Box>
          </InfoBox>
        </Box>
      </div>

      <Box marginTop="32px">
        <AltPrimaryButton id="confirm-deposit-btn" onClick={onComplete} fullWidth>
          Confirm deposit
        </AltPrimaryButton>
      </Box>
    </>
  )
}

const useWaitForConfirmationStyles = makeStyles((theme) =>
  createStyles({
    iconWrapper: {
      backgroundColor: theme.palette.background.lightStone,
      borderRadius: '100%',
      padding: theme.spacing(2.5),
    },
    icon: {
      height: '30px',
      width: '30px',
    },
    title: {
      fontSize: '22px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
  }),
)

const WaitForConfirmation: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const classes = useWaitForConfirmationStyles()

  return (
    <Box display="flex" flexDirection="column" alignItems="center" gridGap="48px">
      <div className={classes.iconWrapper}>
        <div className={classes.icon}>
          <Image src={walletIcon} alt="wallet" />
        </div>
      </div>

      <Typography className={classes.title}>Confirm transaction in your wallet</Typography>
      <Box>
        <AltPrimaryButton id="confirm-tx-btn" onClick={onComplete} fullWidth>
          Simulate confirm transaction
        </AltPrimaryButton>
      </Box>
    </Box>
  )
}

const useStepperStyles = makeStyles((theme) =>
  createStyles({
    root: {
      backgroundColor: 'inherit',
      padding: theme.spacing(5, 0),

      '& [class|="MuiStepConnector-root"]': {
        padding: 0,
      },

      '& [class|="MuiStepConnector-line"]': {
        minHeight: '40px',
      },
    },
  }),
)

function getSteps() {
  return ['Depositing ETH', 'Earning interest']
}

const StepperIcon: React.FC<{ isActive: boolean }> = ({ isActive }) => {
  return (
    <Box
      width="24px"
      height="24px"
      bgcolor={isActive ? 'rgba(112, 227, 246, 0.2)' : 'inherit'}
      border={isActive ? '2px solid #70E3F6' : '2px solid #303436'}
      borderRadius="100%"
    />
  )
}

const useTxStatusStyles = makeStyles({
  title: {
    fontSize: '22px',
    fontWeight: 700,
    letterSpacing: '-0.01em',
  },
  stepLabel: {
    fontSize: '16px',
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: 400,
  },
  activeStepLabel: {
    fontWeight: 700,
    color: 'rgba(255, 255, 255, 1)',
  },
})

const TxStatus: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const classes = useTxStatusStyles()
  const stepperClasses = useStepperStyles()

  const [activeStep] = React.useState(0)
  const steps = getSteps()

  return (
    <Box>
      <Typography className={classes.title}>Deposit in progress</Typography>

      <Stepper classes={stepperClasses} activeStep={activeStep} orientation="vertical">
        {steps.map((label, index) => {
          const isActiveStep = index === activeStep
          return (
            <Step key={label}>
              <StepLabel icon={<StepperIcon isActive={isActiveStep} />}>
                <Typography className={clsx(classes.stepLabel, isActiveStep && classes.activeStepLabel)}>
                  {label}
                </Typography>
              </StepLabel>
            </Step>
          )
        })}
      </Stepper>

      <AltPrimaryButton id="view-dashboard-btn" onClick={onComplete} fullWidth>
        View dashboard
      </AltPrimaryButton>
    </Box>
  )
}

type DepositPreviewModalProps = {
  isOpen: boolean
  onClose: () => void
}

const DepositPreviewModal: React.FC<DepositPreviewModalProps> = ({ isOpen, onClose }) => {
  const [activeStep, setActiveStep] = React.useState(0)

  const handleNext = () => setActiveStep((prevActiveStep) => prevActiveStep + 1)
  const resetStep = () => setActiveStep(0)

  const handleClose = () => {
    resetStep()
    onClose()
  }

  const classes = useModalStyles()

  return (
    <Modal open={isOpen} onClose={handleClose} aria-labelledby="modal-title">
      <Box className={classes.container}>
        {activeStep === 0 && <LPSettings onComplete={handleNext} />}
        {activeStep === 1 && <WaitForConfirmation onComplete={handleNext} />}
        {activeStep === 2 && <TxStatus onComplete={handleClose} />}
      </Box>
    </Modal>
  )
}

export default DepositPreviewModal

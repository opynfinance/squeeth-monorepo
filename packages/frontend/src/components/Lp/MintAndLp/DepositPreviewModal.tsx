import React from 'react'
import { Modal, Box, Typography, Stepper, Step, StepLabel } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import Image from 'next/image'
import clsx from 'clsx'

import { AltPrimaryButton } from '@components/Button'
import walletIcon from 'public/images/wallet.svg'
import LpSettings from './LpSettings'

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

const WaitForConfirmation: React.FC = () => {
  const classes = useWaitForConfirmationStyles()

  return (
    <Box display="flex" flexDirection="column" alignItems="center" gridGap="48px">
      <div className={classes.iconWrapper}>
        <div className={classes.icon}>
          <Image src={walletIcon} alt="wallet" />
        </div>
      </div>

      <Typography className={classes.title}>Confirm transaction in your wallet</Typography>
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
  errorMessage: {
    fontSize: '18px',
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
  buttonMargin: {
    marginTop: '32px',
  },
})

const TxStatusSuccess: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
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

const TxStatusFail: React.FC<{ message: string; onBackClick: () => void }> = ({ message, onBackClick }) => {
  const classes = useTxStatusStyles()

  return (
    <Box display="flex" flexDirection="column" gridGap="24px">
      <Typography className={classes.title}>Deposit failed!</Typography>
      <Typography variant="body1" className={classes.errorMessage}>
        {message}
      </Typography>

      <AltPrimaryButton id="go-back-btn" onClick={onBackClick} fullWidth className={classes.buttonMargin}>
        Go back
      </AltPrimaryButton>
    </Box>
  )
}

const useModalStyles = makeStyles((theme) =>
  createStyles({
    container: {
      width: '80%',
      maxWidth: '640px',
      maxHeight: '90%',
      background: theme.palette.background.default,
      borderRadius: 20,
      overflow: 'auto',
      margin: '5em auto 0px',
      padding: theme.spacing(6),
    },
  }),
)

type DepositPreviewModalProps = {
  isOpen: boolean
  onClose: () => void
  ethToDeposit: string
  setETHToDeposit: React.Dispatch<React.SetStateAction<string>>
}

const DepositPreviewModal: React.FC<DepositPreviewModalProps> = ({
  isOpen,
  onClose,
  ethToDeposit,
  setETHToDeposit,
}) => {
  const [activeStep, setActiveStep] = React.useState(0)
  const [txError, setTxError] = React.useState('')

  const toConfirmationStep = () => setActiveStep(1)
  const toTxStatusStep = () => setActiveStep(2)
  const resetStep = () => setActiveStep(0)

  const handleClose = () => {
    setTxError('')
    resetStep()
    onClose()
  }

  const handleTxFail = (message: string) => {
    setTxError(message)
    toTxStatusStep()
  }

  const resetErrorAndGoBack = () => {
    setTxError('')
    resetStep()
  }

  const classes = useModalStyles()

  return (
    <Modal open={isOpen} onClose={handleClose} aria-labelledby="modal-title">
      <Box className={classes.container}>
        {activeStep === 0 && (
          <LpSettings
            ethToDeposit={ethToDeposit}
            setETHToDeposit={setETHToDeposit}
            onConfirm={toConfirmationStep}
            onTxSuccess={toTxStatusStep}
            onTxFail={(message) => handleTxFail(message)}
          />
        )}
        {activeStep === 1 && <WaitForConfirmation />}
        {activeStep === 2 &&
          (!!txError ? (
            <TxStatusFail message={txError} onBackClick={resetErrorAndGoBack} />
          ) : (
            <TxStatusSuccess onComplete={handleClose} />
          ))}
      </Box>
    </Modal>
  )
}

export default DepositPreviewModal

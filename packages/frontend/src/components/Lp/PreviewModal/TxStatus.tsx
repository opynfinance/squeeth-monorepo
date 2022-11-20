import React from 'react'
import { Box, Typography, Stepper, Step, StepLabel } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import clsx from 'clsx'

import { AltPrimaryButton } from '@components/Button'

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

export const TxStatusSuccess: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
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

export const TxStatusFail: React.FC<{ message: string; onBackClick: () => void }> = ({ message, onBackClick }) => {
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

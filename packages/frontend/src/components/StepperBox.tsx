import Step from '@material-ui/core/Step'
import StepLabel from '@material-ui/core/StepLabel'
import Stepper from '@material-ui/core/Stepper'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React from 'react'

const useStyles = makeStyles((theme) =>
  createStyles({
    stepper: {
      width: '100%',
      marginBottom: theme.spacing(1),
    },
  }),
)

type StepperBoxProps = {
  activeStep: number
  steps?: Array<string>
}

export const StepperBox: React.FC<StepperBoxProps> = ({
  activeStep = 0,
  steps = ['Buy Squeeth to LP', 'LP the SQTH-ETH Uniswap Pool'],
}) => {
  const classes = useStyles()

  return (
    <Stepper activeStep={activeStep} className={classes.stepper}>
      {steps.map((label) => (
        <Step key={label}>
          <StepLabel>{label}</StepLabel>
        </Step>
      ))}
    </Stepper>
  )
}

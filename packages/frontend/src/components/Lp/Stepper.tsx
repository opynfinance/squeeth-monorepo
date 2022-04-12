import { IconButton, Typography } from '@material-ui/core'
import { createStyles, makeStyles, withStyles } from '@material-ui/core/styles'
import ArrowBackIcon from '@material-ui/icons/ArrowBack'
import ArrowForwardIcon from '@material-ui/icons/ArrowForward'
import React from 'react'

import { LPActions, useLPState } from '@context/lp'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      display: 'flex',
      alignItems: 'center',
      marginTop: theme.spacing(0.5),
    },
    stepData: {
      marginLeft: theme.spacing(1),
    },
    stepButton: {
      margin: theme.spacing(0, 0.5),
      '&:disabled': {
        background: theme.palette.background.lightStone,
        opacity: '0.5',
      },
    },
    disabled: {
      backgroundColor: theme.palette.background.lightStone,
      opacity: '1',
    },
  }),
)

const StepperIconButton = withStyles((theme) => ({
  root: {
    background: theme.palette.background.lightStone,
  },
  disabled: {
    background: theme.palette.background.lightStone,
    opacity: '1',
  },
}))(IconButton)

const Stepper: React.FC = () => {
  const classes = useStyles()
  const { lpState, dispatch } = useLPState()

  return (
    <div className={classes.container}>
      <StepperIconButton
        id="lp-prev-step-btn"
        className={classes.stepButton}
        disabled={!lpState.canGoBack}
        classes={{ disabled: classes.disabled }}
        onClick={() => dispatch({ type: LPActions.GO_BACK })}
      >
        <ArrowBackIcon />
      </StepperIconButton>
      <StepperIconButton
        id="lp-next-step-btn"
        className={classes.stepButton}
        disabled={!lpState.canGoForward}
        classes={{ disabled: classes.disabled }}
        onClick={() => dispatch({ type: LPActions.GO_FORWARD })}
      >
        <ArrowForwardIcon />
      </StepperIconButton>
      <Typography className={classes.stepData}>
        0<span id="current-lp-step">{lpState.step}</span> / 03
      </Typography>{' '}
    </div>
  )
}

export default Stepper

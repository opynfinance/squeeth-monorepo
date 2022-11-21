import React from 'react'
import { Box, Typography } from '@material-ui/core'
import { makeStyles } from '@material-ui/core/styles'

import { AltPrimaryButton } from '@components/Button'

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

  return (
    <Box>
      <Typography className={classes.title}>Deposit successful</Typography>

      <Box marginTop="48px">
        <AltPrimaryButton id="view-dashboard-btn" onClick={onComplete} fullWidth>
          View dashboard
        </AltPrimaryButton>
      </Box>
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

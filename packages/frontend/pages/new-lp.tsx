import Nav from '@components/Nav'
import { createStyles, makeStyles, ThemeProvider } from '@material-ui/core/styles'
import { Grid, Typography } from '@material-ui/core'
import React, { useState } from 'react'

import { AltPrimaryButton } from '@components/Button'
import { DepositPreviewModal, TokenInput, PageHeader } from '@components/Lp/MintAndLp'
import getTheme, { Mode } from '../src/theme'
import sqthLogo from '../public/images/squeeth-logo.svg'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(9, 10),
      maxWidth: '1500px',
      width: '95%',
      marginLeft: 'auto',
      marginRight: 'auto',
    },
    title: {
      fontSize: '24px',
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    subtitle: {
      fontSize: '18px',
      fontWeight: 400,
      color: theme.palette.grey[400],
    },
    margin: {
      marginTop: theme.spacing(4),
    },
  }),
)

const LPPage: React.FC = () => {
  const classes = useStyles()
  const [sqthAmount, setSqthAmount] = useState(0)
  const [isPreviewModalOpen, setPreviewModalOpen] = useState(false)

  return (
    <>
      <Nav />

      <PageHeader />

      <Grid container spacing={10} justifyContent="center" className={classes.container}>
        <Grid item xs={12} md={8}>
          <Typography variant="h2" className={classes.title}>
            Pool returns
          </Typography>
          <Typography variant="subtitle1" className={classes.subtitle}>
            Total return combines fees and funding.
          </Typography>
        </Grid>
        <Grid item xs md>
          <Typography className={classes.title} variant="subtitle1">
            Deposit tokens
          </Typography>

          <TokenInput
            id="eth-amount-input"
            value={sqthAmount}
            onChange={setSqthAmount}
            tokenPrice="1500"
            tokenLogo={sqthLogo}
            tokenSymbol="oSQTH"
            tokenBalance="12.34"
          />

          <AltPrimaryButton
            className={classes.margin}
            id="preview-deposit-btn"
            onClick={() => setPreviewModalOpen(true)}
            fullWidth
          >
            Preview deposit
          </AltPrimaryButton>
        </Grid>
      </Grid>

      <DepositPreviewModal isOpen={isPreviewModalOpen} onClose={() => setPreviewModalOpen(false)} />
    </>
  )
}

const ThemeWrapper: React.FC = () => (
  <ThemeProvider theme={getTheme(Mode.NEW_DARK)}>
    <LPPage />
  </ThemeProvider>
)

export default ThemeWrapper

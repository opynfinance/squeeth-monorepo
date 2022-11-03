import Nav from '@components/Nav'
import { createStyles, makeStyles, ThemeProvider } from '@material-ui/core/styles'
import { Grid, Typography, Box } from '@material-ui/core'
import React, { useState } from 'react'

import { PrimaryButton } from '@components/Button'
import { DepositPreviewModal, TokenInput, PageHeader } from '@components/Lp/MintAndLp'
import getTheme, { Mode } from '../src/theme'
import ethLogo from '../public/images/eth-logo.svg'

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
    depositBtn: {
      fontSize: '16px',
      fontWeight: 700,
      textTransform: 'initial',
      width: '100%',
      marginTop: theme.spacing(4),
    },
  }),
)

const LPPage: React.FC = () => {
  const classes = useStyles()
  const [ethAmount, setEthAmount] = useState(0)
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
          <Box>
            <Typography className={classes.title} variant="subtitle1">
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

            <PrimaryButton id="deposit-btn" className={classes.depositBtn} onClick={() => setPreviewModalOpen(true)}>
              Preview deposit
            </PrimaryButton>
          </Box>
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

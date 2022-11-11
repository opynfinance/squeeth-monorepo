import Nav from '@components/Nav'
import { createStyles, makeStyles, ThemeProvider } from '@material-ui/core/styles'
import { Grid, Typography } from '@material-ui/core'
import React, { useState } from 'react'
import { useAtomValue } from 'jotai'

import { AltPrimaryButton } from '@components/Button'
import { DepositPreviewModal, TokenInput, PageHeader } from '@components/Lp/MintAndLp'
import { useWalletBalance } from '@state/wallet/hooks'
import { connectedWalletAtom } from '@state/wallet/atoms'
import { useETHPrice } from '@hooks/useETHPrice'
import { BIG_ZERO } from '@constants/index'
import { toTokenAmount } from '@utils/calculations'
import ethLogo from 'public/images/eth-logo.svg'
import getTheme, { Mode } from '../src/theme'

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
  const { data: walletBalance } = useWalletBalance()
  const ethPrice = useETHPrice()
  const connectedWallet = useAtomValue(connectedWalletAtom)

  const [ethAmount, setEthAmount] = useState('0')
  const [isPreviewModalOpen, setPreviewModalOpen] = useState(false)

  const ethBalance = toTokenAmount(walletBalance ?? BIG_ZERO, 18)
  const classes = useStyles()
  const isDepositButtonDisabled = !connectedWallet || Number(ethAmount) === 0

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
            Mint Squeeth and LP
          </Typography>

          <TokenInput
            id="eth-deposit-amount"
            value={ethAmount}
            onInputChange={setEthAmount}
            symbol="ETH"
            logo={ethLogo}
            usdPrice={ethPrice}
            balance={ethBalance}
          />

          <AltPrimaryButton
            className={classes.margin}
            id="preview-deposit-btn"
            onClick={() => setPreviewModalOpen(true)}
            disabled={isDepositButtonDisabled}
            fullWidth
          >
            {connectedWallet ? 'Preview transaction' : 'Connect wallet to deposit'}
          </AltPrimaryButton>
        </Grid>
      </Grid>

      <DepositPreviewModal
        ethToDeposit={ethAmount}
        isOpen={isPreviewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
      />
    </>
  )
}

const ThemeWrapper: React.FC = () => (
  <ThemeProvider theme={getTheme(Mode.NEW_DARK)}>
    <LPPage />
  </ThemeProvider>
)

export default ThemeWrapper

import Nav from '@components/Nav'
import { createStyles, makeStyles, ThemeProvider } from '@material-ui/core/styles'
import { Grid, Typography } from '@material-ui/core'
import React, { useState } from 'react'
import { useAtomValue } from 'jotai'

import { AltPrimaryButton } from '@components/Button'
import { DepositPreviewModal, TokenInput, PageHeader } from '@components/Lp/MintAndLp'
import { useGetWSqueethPositionValue } from '@state/squeethPool/hooks'
import { addressesAtom } from '@state/positions/atoms'
import { connectedWalletAtom } from '@state/wallet/atoms'
import { useTokenBalance } from '@hooks/contracts/useTokenBalance'
import { OSQUEETH_DECIMALS } from '@constants/index'
import squeethLogo from 'public/images/squeeth-logo.svg'
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
  const { oSqueeth } = useAtomValue(addressesAtom)
  const { value: squeethBalance } = useTokenBalance(oSqueeth, 15, OSQUEETH_DECIMALS)
  const getWSqueethPositionValue = useGetWSqueethPositionValue()

  const [squeethAmount, setSqueethAmount] = useState('0')
  const [isPreviewModalOpen, setPreviewModalOpen] = useState(false)

  const classes = useStyles()

  const squeethPrice = getWSqueethPositionValue(1)
  const connectedWallet = useAtomValue(connectedWalletAtom)
  const isDepositButtonDisabled = !connectedWallet || Number(squeethAmount) === 0

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
            id="squeeth-mint-amount"
            value={squeethAmount}
            onInputChange={setSqueethAmount}
            symbol="oSQTH"
            logo={squeethLogo}
            price={squeethPrice.toString()}
            balance={squeethBalance.toString()}
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
        squeethToMint={squeethAmount}
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

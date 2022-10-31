import Nav from '@components/Nav'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import { Grid, Typography, Box } from '@material-ui/core'
import React, { useState } from 'react'
import { ThemeProvider } from '@material-ui/core/styles'
import Image from 'next/image'

import getTheme, { Mode } from '../src/theme'
import ethLogo from '../public/images/eth-logo.svg'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(5, 10),
      maxWidth: '1500px',
      width: '95%',
      marginLeft: 'auto',
      marginRight: 'auto',
    },
    sectionHeader: {
      fontSize: theme.typography.pxToRem(18),
      fontWeight: 700,
      marginBottom: theme.spacing(1),
    },
  }),
)

const useInputStyles = makeStyles((theme) =>
  createStyles({
    container: {
      width: '340px',
      backgroundColor: 'inherit',
      textAlign: 'left',
      position: 'relative',
      marginBottom: '48px',
    },
    inputContainer: {
      display: 'flex',
      justifyContent: 'space-between',
      border: `2px solid ${theme.palette.background.lightStone}`,
      borderRadius: '12px',
      padding: theme.spacing(2),
      marginTop: '1em',
      backgroundColor: theme.palette.background.default,
    },
    leftInputContainer: {},
    input: {
      display: 'inline-block',
      border: 'none',
      backgroundColor: 'inherit',
      outline: 'none',
      fontSize: '22px',
      width: '204px',

      color: theme.palette.text.primary,
      fontWeight: theme.typography.fontWeightBold,
      fontFamily: theme.typography.fontFamily,
    },
    unitsContainer: {},
    rightInputContainer: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0px 10px',
      height: '28px',
      backgroundColor: theme.palette.background.stone,

      borderRadius: '6px',
    },
    tokenLogoContainer: {
      width: '10px',
      marginRight: theme.spacing(1),
      display: 'flex',
      alignItems: 'center',
    },
    tokenLogo: {
      height: '30px',
      width: 10,
    },
    tokenSymbol: {
      opacity: 0.5,
      fontWeight: 500,
    },
    tokenBalanceContainer: {
      position: 'absolute',
      right: '0',
      left: '0',
      bottom: '-48px',
      zIndex: -10,
      display: 'flex',
      justifyContent: 'space-between',
      padding: '32px 16px 16px 16px',

      backgroundColor: theme.palette.background.stone,
      borderRadius: '12px',
    },
    tokenBalanceLabel: {
      opacity: 0.5,
    },
  }),
)

type TokenInputType = {
  id?: string
  value: string
  onChange: (value: string) => void
  tokenPrice?: string
  tokenSymbol: string
  tokenLogo: string
  tokenBalance: string
}

const TokenInput: React.FC<TokenInputType> = ({
  id,
  value,
  onChange,
  tokenPrice,
  tokenSymbol,
  tokenLogo,
  tokenBalance,
}) => {
  const classes = useInputStyles()

  const handleChange = (inputValue: string) => {
    onChange(inputValue)
  }

  return (
    <div className={classes.container}>
      <div className={classes.inputContainer}>
        <div className={classes.leftInputContainer}>
          <input
            id={id}
            className={classes.input}
            value={value}
            onChange={(event) => handleChange(event.target.value)}
            onWheel={(e) => (e.target as any).blur()}
            placeholder="0"
            type="number"
            min="0"
          />
          <div className={classes.unitsContainer}>
            <Typography variant="caption">${tokenPrice ? Number(value) * Number(tokenPrice) : 0}</Typography>
          </div>
        </div>
        <div className={classes.rightInputContainer}>
          <div className={classes.tokenLogoContainer}>
            <Image src={tokenLogo} alt="logo" className={classes.tokenLogo} />
          </div>
          <span className={classes.tokenSymbol}>{tokenSymbol}</span>
        </div>
      </div>

      <div className={classes.tokenBalanceContainer}>
        <Typography variant="caption" className={classes.tokenBalanceLabel}>
          Available
        </Typography>
        <Typography variant="caption">
          {tokenBalance} {tokenSymbol}
        </Typography>
      </div>
    </div>
  )
}

const LPPage: React.FC = () => {
  const classes = useStyles()
  const [ethAmount, setEthAmount] = useState('0')
  const [sqthAmount, setSqthAmount] = useState('0')

  return (
    <div>
      <Nav />

      <Grid container spacing={10} justifyContent="center" className={classes.container}>
        <Grid item xs={12} md={8}>
          <Typography variant="subtitle1" className={classes.sectionHeader}>
            Pool returns
          </Typography>
        </Grid>
        <Grid item xs md>
          <Box>
            <Typography className={classes.sectionHeader} variant="subtitle1">
              Deposit tokens
            </Typography>

            <Grid container spacing={2}>
              <TokenInput
                id="eth-amount-input"
                value={ethAmount}
                onChange={(value) => setEthAmount(value)}
                tokenPrice="1500"
                tokenLogo={ethLogo}
                tokenSymbol="ETH"
                tokenBalance="12.34"
              />
              <TokenInput
                id="sqth-amount-input"
                value={sqthAmount}
                onChange={(value) => setSqthAmount(value)}
                tokenPrice="90"
                tokenLogo={ethLogo}
                tokenSymbol="oSQTH"
                tokenBalance="56.75"
              />
            </Grid>
          </Box>
        </Grid>
      </Grid>
    </div>
  )
}

const ThemeWrapper: React.FC = () => (
  <ThemeProvider theme={getTheme(Mode.NEW_DARK)}>
    <LPPage />
  </ThemeProvider>
)

export default ThemeWrapper

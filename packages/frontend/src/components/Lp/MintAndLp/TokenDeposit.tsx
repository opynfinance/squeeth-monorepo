import { makeStyles, createStyles } from '@material-ui/core/styles'
import React from 'react'
import { Typography } from '@material-ui/core'

import TokenLogo from './TokenLogo'

const useTokenDepositStyles = makeStyles((theme) =>
  createStyles({
    container: {
      backgroundColor: 'inherit',
      textAlign: 'left',
      position: 'relative',
      marginBottom: '44px',
      width: '48%',
      zIndex: 0,
    },

    mainSection: {
      display: 'flex',
      alignItems: 'center',
      border: `2px solid ${theme.palette.background.lightStone}`,
      borderRadius: '10px',
      padding: theme.spacing(2),
      marginTop: '1em',
      backgroundColor: theme.palette.background.default,
    },

    logoContainer: {
      width: '40px',
      height: '40px',
      marginRight: theme.spacing(1),
      backgroundColor: theme.palette.background.lightStone,
      borderRadius: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logo: {
      height: '24px',
      width: '14px',
    },
    depositContainer: {
      marginLeft: theme.spacing(1),
    },
    amountContainer: {
      display: 'flex',
    },
    amount: {
      fontWeight: 500,
    },
    symbol: {
      opacity: 0.5,
      fontWeight: 400,
      marginLeft: theme.spacing(0.5),
    },
    usdValue: {
      opacity: 0.5,
      fontWeight: 400,
    },
    subSection: {
      position: 'absolute',
      right: '0',
      left: '0',
      bottom: '-44px',
      zIndex: -10,
      display: 'flex',
      justifyContent: 'space-between',
      padding: '40px 16px 12px 16px',
      backgroundColor: theme.palette.background.stone,
      borderRadius: '10px',
    },
    tokenBalanceLabel: {
      opacity: 0.5,
    },
  }),
)

type TokenDepositType = {
  amount: string
  tokenPrice: string
  tokenSymbol: string
  tokenLogo: string
  tokenBalance: string
}

const TokenDeposit: React.FC<TokenDepositType> = ({ amount, tokenPrice, tokenSymbol, tokenLogo, tokenBalance }) => {
  const classes = useTokenDepositStyles()

  return (
    <div className={classes.container}>
      <div className={classes.mainSection}>
        <TokenLogo logoSrc={tokenLogo} />
        <div className={classes.depositContainer}>
          <div className={classes.amountContainer}>
            <Typography className={classes.amount}>{amount}</Typography>
            <Typography className={classes.symbol}>{tokenSymbol}</Typography>
          </div>

          <Typography variant="caption" className={classes.usdValue}>
            ${tokenPrice ? parseInt(amount) * parseInt(tokenPrice) : 0}
          </Typography>
        </div>
      </div>

      <div className={classes.subSection}>
        <Typography variant="subtitle2" className={classes.tokenBalanceLabel}>
          Available
        </Typography>
        <Typography variant="subtitle2">
          {tokenBalance} {tokenSymbol}
        </Typography>
      </div>
    </div>
  )
}

export default TokenDeposit

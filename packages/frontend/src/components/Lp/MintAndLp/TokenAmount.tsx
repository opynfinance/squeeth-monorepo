import { makeStyles, createStyles } from '@material-ui/core/styles'
import React from 'react'
import { Typography, Box } from '@material-ui/core'

import { formatNumber } from '@utils/formatter'
import TokenLogo from './TokenLogo'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      backgroundColor: 'inherit',
      textAlign: 'left',
      position: 'relative',
      marginBottom: '44px',
      width: '50%',
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
    primaryColor: {
      color: theme.palette.primary.main,
    },
  }),
)

type TokenAmountType = {
  amount: string
  price: string
  symbol: string
  logo: string
  balance: string
}

const TokenAmount: React.FC<TokenAmountType> = ({ amount, price, symbol, logo, balance }) => {
  const classes = useStyles()

  const usdValue = price ? Number(amount) * Number(price) : 0

  return (
    <div className={classes.container}>
      <div className={classes.mainSection}>
        <TokenLogo logoSrc={logo} />
        <div className={classes.depositContainer}>
          <div className={classes.amountContainer}>
            <Typography className={classes.amount}>{amount}</Typography>
            <Typography className={classes.symbol}>{symbol}</Typography>
          </div>

          <Typography variant="caption" className={classes.usdValue}>
            {'$' + formatNumber(usdValue)}
          </Typography>
        </div>
      </div>

      <div className={classes.subSection}>
        <Typography variant="subtitle2" className={classes.tokenBalanceLabel}>
          Available
        </Typography>

        <Box display="flex" alignItems="center" gridGap="4px">
          <Typography variant="subtitle2">
            {formatNumber(Number(balance))} {symbol}
          </Typography>

          <Typography variant="subtitle2" className={classes.primaryColor}>
            (Max)
          </Typography>
        </Box>
      </div>
    </div>
  )
}

export default TokenAmount

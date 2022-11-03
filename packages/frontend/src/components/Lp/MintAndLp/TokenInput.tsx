import { makeStyles, createStyles } from '@material-ui/core/styles'
import React from 'react'
import { Typography, InputAdornment } from '@material-ui/core'
import Image from 'next/image'
import clsx from 'clsx'

import { SimpleInput } from './Input'

const useEndAdornmentStyles = makeStyles((theme) =>
  createStyles({
    container: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2px 12px',
      backgroundColor: theme.palette.background.stone,
      borderRadius: '6px',
    },
    logo: {
      width: '11px',
      height: '23px',
      marginRight: theme.spacing(0.75),
    },
    symbol: {
      opacity: 0.5,
      fontWeight: 500,
    },
  }),
)

const EndAdornment: React.FC<{ logo: string; symbol: string }> = ({ logo, symbol }) => {
  const classes = useEndAdornmentStyles()

  return (
    <InputAdornment position="end">
      <div className={classes.container}>
        <div className={classes.logo}>
          <Image src={logo} alt="logo" />
        </div>

        <Typography className={classes.symbol}>{symbol}</Typography>
      </div>
    </InputAdornment>
  )
}

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      backgroundColor: 'inherit',
      textAlign: 'left',
      position: 'relative',
      marginBottom: '44px',
      zIndex: 0,
    },
    inputContainer: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      border: `2px solid ${theme.palette.background.lightStone}`,
      borderRadius: '10px',
      padding: theme.spacing(2),
      marginTop: '1em',
      backgroundColor: theme.palette.background.default,
    },
    leftInputContainer: {},
    input: {
      padding: 0,
      fontSize: '22px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },

    subSection: {
      position: 'absolute',
      right: '0',
      left: '0',
      bottom: '-44px',
      zIndex: -10,
      display: 'flex',
      justifyContent: 'space-between',
      padding: '36px 16px 12px 16px',

      backgroundColor: theme.palette.background.stone,
      borderRadius: '10px',
    },
    smallFont: {
      fontSize: '15px',
    },
    lightFont: {
      opacity: 0.6,
    },
    lightestFont: {
      opacity: 0.5,
    },
  }),
)

type TokenInputType = {
  id?: string
  value: number
  onChange: (value: number) => void
  tokenPrice: string
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
  const classes = useStyles()

  const handleChange = (inputValue: string) => {
    let intValue = parseInt(inputValue)
    intValue = intValue || 0
    onChange(intValue)
  }

  return (
    <div className={classes.container}>
      <div className={classes.inputContainer}>
        <SimpleInput
          fullWidth
          id={id}
          value={value}
          onChange={(event) => handleChange(event.target.value)}
          placeholder="0"
          hasBorder={true}
          InputProps={{
            endAdornment: <EndAdornment logo={tokenLogo} symbol={tokenSymbol} />,
            classes: {
              root: classes.input,
            },
          }}
        />

        <Typography variant="subtitle1" className={classes.lightFont}>
          ${tokenPrice ? value * parseInt(tokenPrice) : 0}
        </Typography>
      </div>

      <div className={classes.subSection}>
        <Typography variant="caption" className={clsx(classes.lightestFont, classes.smallFont)}>
          Available
        </Typography>
        <Typography variant="caption" className={classes.smallFont}>
          {tokenBalance} {tokenSymbol}
        </Typography>
      </div>
    </div>
  )
}

export default TokenInput

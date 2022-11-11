import { TextField, StandardTextFieldProps, Typography, InputAdornment } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import clsx from 'clsx'
import Image from 'next/image'
import BigNumber from 'bignumber.js'

import { formatBalance, formatCurrency } from '@utils/formatter'

const useSimpleInputStyles = makeStyles((theme) =>
  createStyles({
    label: {
      opacity: 0.5,
      '& ~ $input': {
        marginTop: '24px',
      },
    },
    labelFocused: {
      color: theme.palette.primary.main,
      opacity: 0.8,
    },
    input: {
      padding: theme.spacing(0.75, 1.5),
      fontSize: '14px',
    },
    inputBorder: {
      border: '2px solid',
      borderColor: theme.palette.background.lightStone,
      borderRadius: '12px',
    },
    inputFocused: {
      borderColor: theme.palette.primary.main,
    },
  }),
)

type SimpleInputCustomProps = {
  onInputChange: (val: string) => void
  hasBorder?: boolean
}
type SimpleInputProps = StandardTextFieldProps & SimpleInputCustomProps

export const SimpleInput: React.FC<SimpleInputProps> = ({
  id,
  label,
  value,
  onInputChange,
  InputProps,
  InputLabelProps,
  hasBorder = true,
  ...props
}) => {
  const classes = useSimpleInputStyles()

  const handleChange = (val: string) => {
    if (Number(val) < 0) {
      return onInputChange('0')
    }

    if (Number(val) !== 0) {
      // if it is integer, remove leading zeros
      if (!DecimalRegex.test(val)) {
        val = Number(val).toString()
      }
    } else {
      // remain input box w single zero, but keep zero when have decimal
      val = val.replace(/^[0]+/g, '0')
      // if it is no value
      if (val.length === 0) {
        val = '0'
      }
    }

    return onInputChange(val)
  }

  return (
    <TextField
      id={id}
      label={label}
      value={value}
      onChange={(event) => handleChange(event.target.value)}
      InputLabelProps={{
        classes: {
          root: classes.label,
          focused: classes.labelFocused,
        },
        ...InputLabelProps,
      }}
      InputProps={{
        disableUnderline: true,
        classes: {
          root: clsx(classes.input, hasBorder && classes.inputBorder),
          focused: classes.inputFocused,
        },
        ...InputProps,
      }}
      {...props}
    />
  )
}

const useTokenInputAdornmentStyles = makeStyles((theme) =>
  createStyles({
    container: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2px 10px',
      backgroundColor: theme.palette.background.stone,
      borderRadius: '6px',
    },
    logo: {
      width: '20px',
      height: '20px',
      marginRight: theme.spacing(0.75),
    },
    symbol: {
      opacity: 0.5,
      fontWeight: 500,
    },
  }),
)

const TokenInputAdornment: React.FC<{ logo: string; symbol: string }> = ({ logo, symbol }) => {
  const classes = useTokenInputAdornmentStyles()

  return (
    <InputAdornment position="end">
      <div className={classes.container}>
        <div className={classes.logo}>
          <Image src={logo} alt="logo" width="100%" height="100%" />
        </div>

        <Typography className={classes.symbol}>{symbol}</Typography>
      </div>
    </InputAdornment>
  )
}

const useTokenInputStyles = makeStyles((theme) =>
  createStyles({
    container: {
      backgroundColor: 'inherit',
      textAlign: 'left',
      position: 'relative',
      zIndex: 0,
      marginBottom: '44px',
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

type TokenInputCustomProps = {
  onInputChange: (value: string) => void
  usdPrice: BigNumber
  balance: BigNumber
  logo: string
  symbol: string
}
type TokenInputProps = StandardTextFieldProps & TokenInputCustomProps

const DecimalRegex = RegExp('^[0-9]*[.]{1}[0-9]*$')

export const TokenInput: React.FC<TokenInputProps> = ({
  id,
  value,
  onInputChange,
  usdPrice,
  balance,
  logo,
  symbol,
  ...props
}) => {
  const classes = useTokenInputStyles()

  const usdValue = usdPrice.multipliedBy(new BigNumber(value as number)).toNumber() // value is always "number" type

  return (
    <div className={classes.container}>
      <div className={classes.inputContainer}>
        <SimpleInput
          id={id}
          value={isNaN(Number(value)) ? 0 : value}
          onInputChange={onInputChange}
          placeholder="0"
          autoComplete="false"
          fullWidth
          hasBorder
          InputProps={{
            endAdornment: <TokenInputAdornment symbol={symbol} logo={logo} />,
            classes: {
              root: classes.input,
            },
          }}
          {...props}
        />

        <Typography variant="subtitle1" className={classes.lightFont}>
          {usdPrice.isZero() ? 'loading...' : formatCurrency(usdValue)}
        </Typography>
      </div>

      <div className={classes.subSection}>
        <Typography variant="caption" className={clsx(classes.lightestFont, classes.smallFont)}>
          Available
        </Typography>
        <Typography variant="caption" className={classes.smallFont}>
          {formatBalance(balance.toNumber())} {symbol}
        </Typography>
      </div>
    </div>
  )
}

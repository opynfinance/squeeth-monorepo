import { Typography, InputAdornment, Box, ButtonBase } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import clsx from 'clsx'
import Image from 'next/image'
import BigNumber from 'bignumber.js'

import { formatBalance, formatCurrency } from '@utils/formatter'
import InputNumber, { InputNumberProps } from './InputNumber'
import { useTypographyStyles } from '../styles'

const useInputTokenProps = makeStyles((theme) =>
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
    inputRoot: {
      padding: 0,
      fontSize: '22px',
      fontWeight: 500,
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
    adornmentContainer: {
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
  }),
)

interface InputTokenProps extends InputNumberProps {
  usdPrice: BigNumber
  balance: BigNumber
  logo: string
  symbol: string
  onBalanceClick: () => void
}

export const InputToken: React.FC<InputTokenProps> = ({
  value,
  usdPrice,
  balance,
  logo,
  symbol,
  onBalanceClick,
  ...props
}) => {
  const classes = useInputTokenProps()
  const typographyClasses = useTypographyStyles()

  const usdValue = usdPrice.multipliedBy(new BigNumber(value as number)).toNumber() // value is always "number" type

  return (
    <div className={classes.container}>
      <div className={classes.inputContainer}>
        <InputNumber
          value={value}
          fullWidth
          hasBorder
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <div className={classes.adornmentContainer}>
                  <div className={classes.logo}>
                    <Image src={logo} alt="logo" width="100%" height="100%" />
                  </div>

                  <Typography className={clsx(typographyClasses.lightestFontColor, typographyClasses.mediumBold)}>
                    {symbol}
                  </Typography>
                </div>
              </InputAdornment>
            ),
            classes: {
              root: clsx(classes.inputRoot, typographyClasses.monoFont),
            },
          }}
          {...props}
        />

        <Typography
          variant="subtitle1"
          className={clsx(typographyClasses.lighterFontColor, typographyClasses.smallFont, typographyClasses.monoFont)}
        >
          {usdPrice.isZero() ? 'loading...' : formatCurrency(usdValue)}
        </Typography>
      </div>

      <div className={classes.subSection}>
        <Typography
          variant="caption"
          className={clsx(typographyClasses.lightestFontColor, typographyClasses.smallFont)}
        >
          Available
        </Typography>

        <Box display="flex" alignItems="center" gridGap="4px">
          <Typography variant="body2">
            {formatBalance(balance.toNumber())} {symbol}
          </Typography>

          <ButtonBase onClick={onBalanceClick}>
            <Typography variant="subtitle2" color="primary">
              (Max)
            </Typography>
          </ButtonBase>
        </Box>
      </div>
    </div>
  )
}

const useInputTokenDenseStyles = makeStyles((theme) =>
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
    inputRoot: {
      padding: '0px',
      marginBottom: theme.spacing(0.5),
      fontFamily: 'DM Mono',

      '& > input': {
        fontWeight: 500,
        padding: 0,
        marginRight: '8px',
        maxWidth: '120px',

        width: ({ inputLength }: any): string => `${inputLength}ch`,
      },
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
      height: '20px',
      width: '20px',
    },
    subSection: {
      position: 'absolute',
      right: '0',
      left: '0',
      bottom: '-44px',
      zIndex: -10,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '40px 16px 12px 16px',
      backgroundColor: theme.palette.background.stone,
      borderRadius: '10px',
    },
  }),
)

// This the "Dense" variant of InputToken
export const InputTokenDense: React.FC<InputTokenProps> = ({
  value,
  usdPrice,
  balance,
  logo,
  symbol,
  onBalanceClick,
  ...props
}) => {
  const classes = useInputTokenDenseStyles({ inputLength: (value as string).length })
  const typographyClasses = useTypographyStyles()

  const usdValue = usdPrice.multipliedBy(new BigNumber(value as string)).toNumber()

  return (
    <div className={classes.container}>
      <div className={classes.mainSection}>
        <div className={classes.logoContainer}>
          <div className={classes.logo}>
            <Image src={logo} alt="logo" height="100%" width="100%" />
          </div>
        </div>

        <Box marginLeft="8px">
          <Box display="flex" alignItems="center" gridGap="4px">
            <InputNumber
              value={value}
              fullWidth={false}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="start">
                    <Typography className={clsx(typographyClasses.mediumBold, typographyClasses.lightestFontColor)}>
                      {symbol}
                    </Typography>
                  </InputAdornment>
                ),
                classes: {
                  root: classes.inputRoot,
                },
              }}
              {...props}
            />
          </Box>

          <Typography
            variant="caption"
            className={clsx(
              typographyClasses.mediumBold,
              typographyClasses.lightestFontColor,
              typographyClasses.monoFont,
            )}
          >
            {usdPrice.isZero() ? 'loading...' : formatCurrency(usdValue)}
          </Typography>
        </Box>
      </div>

      <div className={classes.subSection}>
        <Typography variant="body2" className={typographyClasses.lightestFontColor}>
          Available
        </Typography>

        <Box display="flex" alignItems="center" gridGap="4px">
          <Typography variant="body2">
            {formatBalance(balance.toNumber())} {symbol}
          </Typography>

          <ButtonBase onClick={onBalanceClick}>
            <Typography variant="subtitle2" color="primary">
              (Max)
            </Typography>
          </ButtonBase>
        </Box>
      </div>
    </div>
  )
}
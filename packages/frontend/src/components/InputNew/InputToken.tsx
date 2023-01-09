import { Typography, InputAdornment, Box, ButtonBase, CircularProgress, Tooltip } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import clsx from 'clsx'
import Image from 'next/image'
import BigNumber from 'bignumber.js'

import { formatBalance, formatCurrency } from '@utils/formatter'
import useTextStyles from '@styles/useTextStyles'
import InputNumber, { InputNumberProps } from './InputNumber'

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
      justifyContent: 'center',
      padding: '2px 10px',
      backgroundColor: theme.palette.background.stone,
      borderRadius: '6px',
    },
    logo: {
      width: '18px',
      height: '18px',
      marginRight: theme.spacing(1),
    },
    textMonospace: {
      fontFamily: 'DM Mono',
    },
  }),
)

interface InputTokenProps extends InputNumberProps {
  usdPrice: BigNumber
  balance: BigNumber
  logo: string
  symbol: string
  onBalanceClick?: () => void
  showMaxAction?: boolean
  isLoading?: boolean
  loadingMessage?: string
  readOnlyTooltip?: string
}

export const InputToken: React.FC<InputTokenProps> = ({
  value,
  usdPrice,
  balance,
  logo,
  symbol,
  onBalanceClick = () => {},
  showMaxAction = true,
  isLoading = false,
  loadingMessage = 'loading...',
  readOnly = false,
  readOnlyTooltip = '',

  ...props
}) => {
  const classes = useInputTokenProps()
  const textClasses = useTextStyles()

  const usdValue = usdPrice.multipliedBy(new BigNumber(value as number)).toNumber() // value is always "number" type

  return (
    <div className={classes.container}>
      <div className={classes.inputContainer}>
        <Tooltip title={readOnlyTooltip} placement="bottom">
          <InputNumber
            value={value}
            fullWidth
            hasBorder
            readOnly={readOnly}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <div className={classes.adornmentContainer}>
                    <div className={classes.logo}>
                      <Image src={logo} alt="logo" width="100%" height="100%" />
                    </div>

                    <Typography className={clsx(textClasses.lightestFontColor, textClasses.mediumBold)}>
                      {symbol}
                    </Typography>
                  </div>
                </InputAdornment>
              ),
              classes: {
                root: clsx(classes.inputRoot, textClasses.monoFont),
              },
            }}
            {...props}
          />
        </Tooltip>

        {isLoading ? (
          <Box display="flex" alignItems="center" gridGap="8px">
            <CircularProgress color="primary" size="1rem" />
            <Typography className={clsx(textClasses.lighterFontColor, textClasses.smallFont, textClasses.monoFont)}>
              {loadingMessage}
            </Typography>
          </Box>
        ) : (
          <Typography className={clsx(textClasses.lighterFontColor, textClasses.smallFont, textClasses.monoFont)}>
            {formatCurrency(usdValue)}
          </Typography>
        )}
      </div>

      <div className={classes.subSection}>
        <Typography variant="caption" className={clsx(textClasses.lightestFontColor, textClasses.smallFont)}>
          {'Balance'}
        </Typography>

        <Box display="flex" alignItems="center" gridGap="4px">
          <Typography variant="body2" className={classes.textMonospace}>
            {formatBalance(balance.toNumber())}
          </Typography>
          <Typography variant="body2">{` ${symbol}`}</Typography>

          {showMaxAction && (
            <ButtonBase onClick={onBalanceClick}>
              <Typography variant="subtitle2" color="primary">
                (Max)
              </Typography>
            </ButtonBase>
          )}
        </Box>
      </div>
    </div>
  )
}

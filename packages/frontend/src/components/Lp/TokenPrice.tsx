import React from 'react'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import { Typography } from '@material-ui/core'
import BigNumber from 'bignumber.js'

import { formatCurrency } from '@utils/formatter'

const useTokenPriceStyles = makeStyles((theme) =>
  createStyles({
    priceContainer: {
      display: 'flex',
      gap: theme.spacing(1),
    },
    defaultVariant: {
      color: 'rgba(255, 255, 255, 0.8)',
      fontSize: '14px',
    },
    smallVariant: {
      color: 'rgba(255, 255, 255, 0.6)',
      fontSize: '12px',
    },
  }),
)

const TokenPrice: React.FC<{ symbol: string; usdPrice: BigNumber; isSmall?: boolean }> = ({
  symbol,
  usdPrice,
  isSmall = false,
}) => {
  const classes = useTokenPriceStyles()
  const textClassName = isSmall ? classes.smallVariant : classes.defaultVariant

  return (
    <div className={classes.priceContainer}>
      <Typography className={textClassName}>{`1 ${symbol}`}</Typography>
      <Typography className={textClassName}>{'='}</Typography>
      <Typography className={textClassName}>
        {usdPrice.isZero() ? 'loading...' : formatCurrency(usdPrice.toNumber())}
      </Typography>
    </div>
  )
}

export default TokenPrice

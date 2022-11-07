import React from 'react'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import { Typography, Box, BoxProps } from '@material-ui/core'
import clsx from 'clsx'

type TokenPriceStyleProps = {
  fontSize: string
  color: string
}

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

const TokenPrice: React.FC<{ symbol: string; price: string; isSmall?: boolean }> = ({
  symbol,
  price,
  isSmall = false,
}) => {
  const classes = useTokenPriceStyles()

  const textClassName = isSmall ? classes.smallVariant : classes.defaultVariant

  return (
    <div className={classes.priceContainer}>
      <Typography className={textClassName}>{`1 ${symbol}`}</Typography>
      <Typography className={textClassName}>{'='}</Typography>
      <Typography className={textClassName}>{`$${price}`}</Typography>
    </div>
  )
}

export default TokenPrice

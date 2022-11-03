import React from 'react'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import { Typography } from '@material-ui/core'

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
    priceText: (props: TokenPriceStyleProps) => ({
      fontSize: props.fontSize,
      color: props.color,
    }),
  }),
)

const TokenPrice: React.FC<{ symbol: string; price: string; styleProps?: TokenPriceStyleProps }> = ({
  symbol,
  price,
  styleProps = { fontSize: '14px', color: 'rgba(255, 255, 255)' },
}) => {
  const classes = useTokenPriceStyles(styleProps)

  return (
    <div className={classes.priceContainer}>
      <Typography className={classes.priceText}>{`1 ${symbol}`}</Typography>
      <Typography className={classes.priceText}>{'='}</Typography>
      <Typography className={classes.priceText}>{`$${price}`}</Typography>
    </div>
  )
}

export default TokenPrice

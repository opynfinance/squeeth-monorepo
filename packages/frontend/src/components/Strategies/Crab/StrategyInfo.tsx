import ShortSqueethPayoff from '@components/Charts/ShortSqueethPayoff'
import { useWorldContext } from '@context/world'
import { Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React from 'react'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(0),
      marginTop: theme.spacing(4),
      maxWidth: '640px',
    },
    content: {
      marginTop: theme.spacing(1),
    },
    title: {
      marginTop: theme.spacing(2),
    },
  }),
)

export const StrategyInfo: React.FC = () => {
  const classes = useStyles()
  const { ethPrice } = useWorldContext()

  return (
    <div className={classes.container}>
      <Typography variant="h5" color="primary" className={classes.title}>
        Payoff
      </Typography>
      <ShortSqueethPayoff ethPrice={ethPrice.toNumber()} collatRatio={2} />
      <Typography variant="h5" color="primary" className={classes.title}>
        Risk
      </Typography>
      <Typography color="textSecondary" variant="subtitle1" className={classes.content}>
        If the Crab Strategy falls below the safe collateralization threshold (150%), the strategy is at risk of
        liquidation. Rebalancing based on large ETH price changes helps prevent a liquidation from occurring. If ETH
        moves more than an amount that is based on the funding received from the short Squeeth position (approximately
        6% in either direction in a single day, subject to volatility) the strategy is unprofitable. In other words, the
        Crab Strategy takes the view that volatility is high. If ETH goes up or down more than the amount of implied
        volatility, the strategy loses money. If the Squeeth premium to ETH increases, the strategy will incur a loss
        because it will be more expensive to close the position.
      </Typography>
    </div>
  )
}

export default StrategyInfo

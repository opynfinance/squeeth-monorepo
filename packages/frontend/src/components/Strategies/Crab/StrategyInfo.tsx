import ShortSqueethPayoff from '@components/Charts/ShortSqueethPayoff'
import { useWorldContext } from '@context/world'
import { Typography } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React from 'react'
import { useCrabStrategy } from '@hooks/contracts/useCrabStrategy'
import { Links } from '@constants/enums'
import CrabProfit from '../../../../public/images/CrabProfit.svg'
import CrabSteps from '../../../../public/images/CrabSteps.svg'
import Image from 'next/image'

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
    link: {
      color: theme.palette.primary.main,
    },
    profitImage: {
      marginTop: theme.spacing(2),
    },
    stepsImage: {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(4),
    },
    caption: {
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(4),
    },
  }),
)

export const StrategyInfo: React.FC = () => {
  const classes = useStyles()
  const { ethPrice } = useWorldContext()
  const { profitableMovePercent } = useCrabStrategy()

  return (
    <div className={classes.container}>
      <Typography variant="h5" color="primary" className={classes.title}>
        Profitability
      </Typography>
      <div className={classes.profitImage}>
        <Image src={CrabProfit} alt="Profitability" />
      </div>
      <Typography color="textSecondary" variant="subtitle1" className={classes.caption}>
        Based on current funding, crab strategy would be unprofitable if ETH moves more than the profit threshold of
        approximately {(profitableMovePercent * 100).toFixed(2)}% in either direction each day.
      </Typography>
      <Typography variant="h5" color="primary" className={classes.title}>
        Payoff
      </Typography>
      <ShortSqueethPayoff ethPrice={ethPrice.toNumber()} collatRatio={2} />
      <Typography variant="h5" color="primary" className={classes.title}>
        Steps
      </Typography>
      <div className={classes.stepsImage}>
        <Image src={CrabSteps} alt="Steps" />
      </div>
      <Typography variant="h5" color="primary" className={classes.title}>
        Risk
      </Typography>
      <Typography color="textSecondary" variant="subtitle1" className={classes.content}>
        If the Crab Strategy falls below the safe collateralization threshold (150%), the strategy is at risk of
        liquidation. Rebalancing based on large ETH price changes helps prevent a liquidation from occurring.
        <br /> <br />
        Based on current funding, crab strategy would be unprofitable if ETH moves more than approximately{' '}
        {(profitableMovePercent * 100).toFixed(2)}% in either direction each day. If the Squeeth premium to ETH
        increases, the strategy will incur a loss because it will be more expensive to close the position.
        <a className={classes.link} href={Links.CrabFAQ} target="_blank" rel="noreferrer">
          {' '}
          Learn more.{' '}
        </a>
        <br /> <br />
        Crab smart contracts have been audited by Trail of Bits, Akira, and Sherlock. However, smart contracts are
        experimental technology and we encourage caution only risking funds you can afford to lose.
      </Typography>
    </div>
  )
}

export default StrategyInfo

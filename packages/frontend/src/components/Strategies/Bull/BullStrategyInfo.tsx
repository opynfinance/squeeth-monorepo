import { Typography, Box } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React from 'react'
import Image from 'next/image'
import clsx from 'clsx'

import { Links } from '@constants/enums'
import BullProfit from 'public/images/BullProfit.svg'
import { formatNumber } from '@utils/formatter'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(0),
      maxWidth: '840px',
    },
    content: {
      marginTop: theme.spacing(1),
    },
    title: {
      marginTop: theme.spacing(8),
    },
    link: {
      color: theme.palette.primary.main,
    },
    profitImage: {
      marginTop: theme.spacing(2),
      borderRadius: theme.spacing(1),
    },
    caption: {
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(4),
    },
    fontColorCaption: {
      color: '#bdbdbd',
    },
    fontColorBody: {
      color: '#babbbb',
    },
    subtitle: {
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
  }),
)

type BullStrategyInfoType = {
  lowerPriceBandForProfitability: number
  upperPriceBandForProfitability: number
}

export const BullStrategyInfo: React.FC<BullStrategyInfoType> = ({
  lowerPriceBandForProfitability,
  upperPriceBandForProfitability,
}) => {
  const classes = useStyles()
  const shortSqueethPosition = `150%`
  const ethLeveragePosition = `127%`

  return (
    <Box>
      <Typography variant="h4" className={classes.subtitle}>
        Profitability conditions
      </Typography>
      <div className={classes.container}>
        <Typography variant="subtitle1" className={clsx(classes.caption, classes.fontColorCaption)}>
          Zen bull likes zen bull markets. It makes money when ETH goes up, slow and steady. It stacks ETH when ETH
          stays within around ${formatNumber(lowerPriceBandForProfitability)}- $
          {formatNumber(upperPriceBandForProfitability)} before the next rebalance.
        </Typography>

        <div className={classes.profitImage}>
          <Image src={BullProfit} alt="Bull Profitability" />
        </div>

        <Box marginTop="60px">
          <Typography variant="h4" className={classes.subtitle}>
            Risk
          </Typography>
          <Typography variant="subtitle1" className={clsx(classes.content, classes.fontColorBody)}>
            The Zen Bull Strategy contains a short squeeth and an ETH leverage position. If the strategy falls below the
            safe collateralization threshold ({shortSqueethPosition} on the short squeeth position and{' '}
            {ethLeveragePosition} on the ETH leverage position), the strategy is at risk of liquidation. Rebalancing
            based on large ETH price changes helps prevent a liquidation from occurring.
            <br /> <br />
            Based on current premiums, zen bull strategy would only be stacking ETH if ETH stays within ETH stays within
            around ${formatNumber(lowerPriceBandForProfitability)}- ${formatNumber(upperPriceBandForProfitability)}{' '}
            before the next rebalance. The implied premium which you deposit at impacts your profitability. Depositing
            at a higher premium than expected increases likelihood of profitability.
            <br /> <br />
            If the Squeeth premium increases, it will be more expensive to close your position. Zen bull aims to be
            profitable in ETH terms.{' '}
            <a className={classes.link} href={Links.CrabFAQ} target="_blank" rel="noreferrer">
              {' '}
              Learn more.{' '}
            </a>
            <br /> <br />
            Zen bull smart contracts have been audited by Open Zeppelin. However, smart contracts are experimental
            technology and we encourage caution only risking funds you can afford to lose.
          </Typography>
        </Box>
      </div>
    </Box>
  )
}

export default BullStrategyInfo

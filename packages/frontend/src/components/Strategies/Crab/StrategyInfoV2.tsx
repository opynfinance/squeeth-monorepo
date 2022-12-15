import { Typography, Radio, RadioGroup, FormControl, FormControlLabel, FormLabel } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React from 'react'
import Image from 'next/image'
import clsx from 'clsx'

import { Links } from '@constants/enums'
import CrabProfit_Flat from 'public/images/CrabProfit_Flat_v2.svg'
import CrabProfit_Increase from 'public/images/CrabProfit_Increase_v2.svg'
import CrabProfit_Decrease from 'public/images/CrabProfit_Decrease_v2.svg'
import { useSetProfitableMovePercentV2 } from '@state/crab/hooks'

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
    stepsImage: {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(4),
    },
    caption: {
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(4),
    },
    chartTitle: {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(4),
    },
    radioTitle: {
      marginTop: theme.spacing(2),
    },
    fontColor: {
      color: '#bdbdbd',
    },
    subtitle: {
      fontSize: '20px',
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
  }),
)

export const StrategyInfo: React.FC = () => {
  const classes = useStyles()
  const profitableMovePercent = useSetProfitableMovePercentV2()

  const [profitToggle, setProfitToggle] = React.useState('flat')

  return (
    <div className={classes.container}>
      <FormControl className={classes.radioTitle}>
        <FormLabel>Before the next hedge, if ETH approximately</FormLabel>
        <RadioGroup
          row
          name="At the end of one day, if ETH approximately"
          value={profitToggle}
          onChange={(event) => setProfitToggle(event.target.value)}
        >
          <FormControlLabel
            value="increase"
            control={<Radio />}
            label={`increases ~${(profitableMovePercent * 100).toFixed(2)}%`}
          />
          <FormControlLabel
            value="flat"
            control={<Radio />}
            label={`moves less than ~${(profitableMovePercent * 100).toFixed(2)}%`}
          />
          <FormControlLabel
            value="descrease"
            control={<Radio />}
            label={`decreases ~${(profitableMovePercent * 100).toFixed(2)}%`}
          />
        </RadioGroup>
      </FormControl>
      <div className={classes.profitImage}>
        {profitToggle === 'flat' ? (
          <Image src={CrabProfit_Flat} alt="Profitability Flat" />
        ) : profitToggle === 'increase' ? (
          <Image src={CrabProfit_Increase} alt="Profitability Increase" />
        ) : (
          <Image src={CrabProfit_Decrease} alt="Profitability Decrease" />
        )}
      </div>
      <Typography variant="subtitle1" className={clsx(classes.caption, classes.fontColor)}>
        Based on current premiums, crab strategy would be unprofitable if ETH moves more than the profit threshold of
        approximately <b>{(profitableMovePercent * 100).toFixed(2)}%</b> in either direction between 2 day hedges. Crab
        hedges approximately three times a week (on MWF). Crab aims to be profitable in USD terms.
      </Typography>

      <Typography variant="h4" className={classes.subtitle}>
        Risk
      </Typography>
      <Typography variant="subtitle1" className={clsx(classes.content, classes.fontColor)}>
        If the Crab Strategy falls below the safe collateralization threshold (150%), the strategy is at risk of
        liquidation. Rebalancing based on large ETH price changes helps prevent a liquidation from occurring.
        <br /> <br />
        Based on current premiums, crab strategy would be unprofitable if ETH moves more than approximately{' '}
        {(profitableMovePercent * 100).toFixed(2)}% in either direction before the next hedge. The implied premium which
        you deposit at impacts your profitability. Depositing at a high premium increases likelihood of profitability.
        <br /> <br />
        If the Squeeth premium to ETH increases, the strategy will incur a loss because it will be more expensive to
        close the position. Crab aims to be profitable in USD terms.
        <a className={classes.link} href={Links.CrabFAQ} target="_blank" rel="noreferrer">
          {' '}
          Learn more.{' '}
        </a>
        <br /> <br />
        Crab smart contracts have been audited by Sherlock. However, smart contracts are experimental technology and we
        encourage caution only risking funds you can afford to lose.
      </Typography>
    </div>
  )
}

export default StrategyInfo

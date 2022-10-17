import ShortSqueethPayoff from '@components/Charts/ShortSqueethPayoff'
import { Typography, Radio, RadioGroup, FormControl, FormControlLabel, FormLabel } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React from 'react'
import { Links, Vaults } from '@constants/enums'
import CrabProfit_Flat from '../../../../public/images/CrabProfit_Flat_v2.svg'
import CrabProfit_Increase from '../../../../public/images/CrabProfit_Increase_v2.svg'
import CrabProfit_Decrease from '../../../../public/images/CrabProfit_Decrease_v2.svg'
import CrabSteps from '../../../../public/images/CrabSteps.svg'
import Image from 'next/image'
import { MemoizedCrabStrategyChart as CrabStrategyChart } from '@components/Charts/CrabStrategyChart'
import { useETHPrice } from '@hooks/useETHPrice'
import { useSetProfitableMovePercentV2 } from 'src/state/crab/hooks'

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(0),
      margin: '40px auto 0',
      marginTop: theme.spacing(4),
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
  }),
)

export const StrategyInfo: React.FC = () => {
  const classes = useStyles()
  const ethPrice = useETHPrice()
  const profitableMovePercent = useSetProfitableMovePercentV2()

  const [profitToggle, setProfitToggle] = React.useState('flat')

  return (
    <div className={classes.container}>
      {/* <Typography variant="h5" color="primary" className={classes.chartTitle}>
        Historical PnL Simulation
      </Typography> */}
      {/* <CrabStrategyChart vault={Vaults.Short} longAmount={0} /> */}
      <Typography variant="h5" color="primary" className={classes.title}>
        Profitability between hedges
      </Typography>
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
      <Typography color="textSecondary" variant="subtitle1" className={classes.caption}>
        Based on current premiums, crab strategy would be unprofitable if ETH moves more than the profit threshold of
        approximately <b>{(profitableMovePercent * 100).toFixed(2)}%</b> in either direction between 2 day hedges. Crab
        hedges approximately three times a week (on MWF). Crab aims to be profitable in USD terms.
      </Typography>
      {/* <Typography variant="h5" color="primary" className={classes.title}>
        Payoff
      </Typography>
      <ShortSqueethPayoff ethPrice={ethPrice.toNumber()} collatRatio={2} /> */}
      {/* <Typography variant="h5" color="primary" className={classes.title}>
        Steps
      </Typography>
      <div className={classes.stepsImage}>
        <Image src={CrabSteps} alt="Steps" />
      </div> */}
      <Typography variant="h5" color="primary" className={classes.title}>
        Risk
      </Typography>
      <Typography color="textSecondary" variant="subtitle1" className={classes.content}>
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

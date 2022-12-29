import React from 'react'
import { Box, Typography } from '@material-ui/core'
import clsx from 'clsx'
import { makeStyles, createStyles } from '@material-ui/core/styles'

import NextRebalanceTimer from './NextRebalanceTimer'
import ProfitabilityChart from './ProfitabilityChart'
import AdvancedMetrics from './AdvancedMetrics'
import useStyles from '@components/Strategies/styles'
import { LinkWrapper } from '@components/LinkWrapper'

const useAboutStyles = makeStyles((theme) =>
  createStyles({
    timerContainer: {
      position: 'absolute',
      top: '10px',
      right: '0',

      [theme.breakpoints.down('sm')]: {
        position: 'relative',
        top: '0px',
        right: '0',
        marginBottom: '16px',
      },
    },
  }),
)

const About: React.FC = () => {
  const classes = useStyles()
  const aboutClasses = useAboutStyles()

  return (
    <div>
      <Box display="flex" flexDirection="column" gridGap="8px">
        <Typography variant="h3" className={classes.sectionTitle}>
          About Crab
        </Typography>
        <Typography variant="h2" className={classes.heading}>
          Stack USDC when ETH is calm
        </Typography>

        <Typography className={clsx(classes.text, classes.textMargin)}>
          In general, Crab earns USDC returns except when there is high ETH volatility in the market, when it may draw
          down. Most often, the strategy stacks USDC if ETH is within the below bands at the next hedge.{' '}
          <LinkWrapper href="https://opyn.gitbook.io/squeeth/resources/crab-strategy">Learn more</LinkWrapper>
        </Typography>
      </Box>

      <Box position="relative" marginTop="32px">
        <div className={aboutClasses.timerContainer}>
          <NextRebalanceTimer />
        </div>
        <ProfitabilityChart />
      </Box>

      <Box marginTop="16px">
        <AdvancedMetrics />
      </Box>
    </div>
  )
}

export default About

import React from 'react'
import { Box, Typography } from '@material-ui/core'
import clsx from 'clsx'

import NextRebalanceTimer from './NextRebalanceTimer'
import ProfitabilityChart from './ProfitabilityChart'
import useStyles from '@components/Strategies/Crab/useStyles'

const About: React.FC = () => {
  const classes = useStyles()

  return (
    <div>
      <Box display="flex" flexDirection="column" gridGap="8px">
        <Typography variant="h3" className={classes.sectionTitle}>
          About Crab
        </Typography>
        <Typography variant="h2" className={classes.heading}>
          Stack USDC when ETH is flat
        </Typography>

        <Typography className={clsx(classes.text, classes.textMargin)}>
          In general, Crab earns USDC returns except when there is high ETH volatility in the market, when it may draw
          down. The strategy stacks USDC if ETH is within the below bands at the next hedge.
        </Typography>
      </Box>

      <Box position="relative" marginTop="32px">
        <Box position="absolute" top="10px" right="0px">
          <NextRebalanceTimer />
        </Box>
        <ProfitabilityChart />
      </Box>
    </div>
  )
}

export default About

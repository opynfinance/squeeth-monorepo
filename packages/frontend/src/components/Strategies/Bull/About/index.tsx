import React from 'react'
import { Box, Typography } from '@material-ui/core'
import clsx from 'clsx'
import { makeStyles, createStyles } from '@material-ui/core/styles'

import NextRebalanceTimer from './NextRebalanceTimer'
import ProfitabilityChart from './ProfitabilityChart'
import AdvancedMetrics from './AdvancedMetrics'
import useStyles from '@components/Strategies/styles'
import { LinkWrapper } from '@components/LinkWrapper'
import useAmplitude from '@hooks/useAmplitude'
import { SITE_EVENTS } from '@utils/amplitude'

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

const gitBookLink = 'https://opyn.gitbook.io/opyn-strategies/zen-bull/introduction'

const About: React.FC = () => {
  const classes = useStyles()
  const aboutClasses = useAboutStyles()
  const { track } = useAmplitude()

  return (
    <div>
      <Box display="flex" flexDirection="column" gridGap="8px">
        <Typography variant="h1" className={classes.sectionTitle}>
          About Zen Bull Strategy
        </Typography>
        <Typography variant="h2" className={classes.heading}>
          Stack ETH when ETH increases slow and steady
        </Typography>

        <Typography className={clsx(classes.text, classes.textMargin)}>
          The Zen Bull strategy makes money when ETH goes up, slow and steady. In general, it stacks ETH if ETH is
          within the below price bands at the next rebalance.{' '}
          <LinkWrapper
            href={gitBookLink}
            onClick={() => track(SITE_EVENTS.CLICK_LEARN_MORE_BULL, { link: gitBookLink })}
          >
            Learn more
          </LinkWrapper>
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

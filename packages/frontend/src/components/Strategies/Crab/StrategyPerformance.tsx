import React from 'react'
import { Box, Typography, Tooltip } from '@material-ui/core'
import HelpOutlineIcon from '@material-ui/icons/HelpOutline'
import clsx from 'clsx'

import useStyles from '@components/Strategies/Crab/useStyles'

const About: React.FC = () => {
  const classes = useStyles()

  const performance = 20.3

  return (
    <Box display="flex" flexDirection="column" gridGap="8px">
      <Typography variant="h3" className={classes.sectionTitle}>
        Strategy Performance
      </Typography>
      <Box display="flex" alignItems="baseline" gridGap="12px">
        <Typography
          variant="h2"
          className={clsx(classes.heading, performance >= 0 ? classes.colorSuccess : classes.colorError)}
        >
          {performance >= 0 && '+'}
          {performance}%
        </Typography>
        <Typography className={classes.description}>Annual USD Return</Typography>

        <Box position="relative" top="3px">
          <Tooltip title={`historical returns, selected dates`}>
            <HelpOutlineIcon fontSize="small" className={classes.infoIcon} />
          </Tooltip>
        </Box>
      </Box>

      <Box display="flex" gridGap="12px">
        <Typography className={clsx(classes.description, classes.textMonospace)}>$2,960,000</Typography>
        <Typography className={classes.description}>TVL</Typography>
      </Box>
    </Box>
  )
}

export default About

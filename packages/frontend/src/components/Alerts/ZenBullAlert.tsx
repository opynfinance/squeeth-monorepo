import React from 'react'
import Link from 'next/link'
import { Typography, useMediaQuery, useTheme } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'

import Alert from '../Alert'

const useStyles = makeStyles((theme) =>
  createStyles({
    link: {
      fontSize: '15px',
      fontWeight: 500,
      color: theme.palette.primary.main,
    },
    container: {
      maxWidth: '1280px',
      width: '80%',
      margin: '12px auto 0 auto',

      [theme.breakpoints.down('lg')]: {
        maxWidth: 'none',
        width: 'calc(90% - 80px)',
      },
      [theme.breakpoints.down('md')]: {
        width: 'calc(100% - 6vw)',
        gridGap: '40px',
      },
    },
  }),
)

export const ZenBullAlert = () => {
  const classes = useStyles()

  const theme = useTheme()
  const isMobileBreakpoint = useMediaQuery(theme.breakpoints.down('xs'))

  return (
    <div className={classes.container}>
      <Alert severity="warning" showIcon={!isMobileBreakpoint}>
        <Typography style={{ fontSize: '15px', fontWeight: 500 }}>
          Zen Bull has been impacted by the Euler Finance exploit. All other Squeeth contracts are unaffected. Please{' '}
          <Link href="https://opyn.gitbook.io/opyn-strategies/strategies-faq/faq">
            <a className={classes.link} target="_blank">
              join discord
            </a>
          </Link>{' '}
          for updates. You can recover funds from Recovery withdrawal section below.
        </Typography>
      </Alert>
    </div>
  )
}

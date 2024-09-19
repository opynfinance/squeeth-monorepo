import React from 'react'
import Link from 'next/link'
import { Typography, useMediaQuery, useTheme } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import { format } from 'date-fns'

import Alert from '../Alert'
import { SHUTDOWN_DATE } from '@constants/index'

const useStyles = makeStyles((theme) =>
  createStyles({
    link: {
      color: theme.palette.primary.main,
      '&:hover': {
        textDecoration: 'underline',
      },
    },
    boldText: {
      fontWeight: 700,
    },
    text: {
      fontSize: '15px',
      fontWeight: 500,
    },
    textBig: {
      fontSize: '16.5px',
      fontWeight: 600,
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

export const ShutdownAlert: React.FC = () => {
  const classes = useStyles()

  const theme = useTheme()
  const isMobileBreakpoint = useMediaQuery(theme.breakpoints.down('xs'))

  const shutdownDate = new Date(SHUTDOWN_DATE)

  // Format the date, using UTC methods to ensure UTC time
  const shutdownDateFormatted = format(
    new Date(
      shutdownDate.getUTCFullYear(),
      shutdownDate.getUTCMonth(),
      shutdownDate.getUTCDate(),
      shutdownDate.getUTCHours(),
      shutdownDate.getUTCMinutes(),
    ),
    "MMMM d, yyyy 'at' HH:mm 'UTC'",
  )

  return (
    <div className={classes.container}>
      <Alert severity="warning" showIcon={!isMobileBreakpoint}>
        <div>
          <Typography variant="body1" className={classes.textBig}>
            Squeeth will be shutting down on {shutdownDateFormatted} as{' '}
            <Link href="https://markets.opyn.co" passHref>
              <a className={classes.link} target="_blank" rel="noopener noreferrer">
                Opyn Markets
              </a>
            </Link>{' '}
            gears up for launch
          </Typography>
          <Typography variant="body2" className={classes.text} style={{ marginTop: theme.spacing(1) }}>
            The protocol will function normally until shutdown, meaning positions can be opened and closed at
            users&apos; discretion and Squeeth will continue to track ETH^2.
          </Typography>
          <Typography variant="body2" className={classes.text} style={{ marginTop: theme.spacing(0.5) }}>
            At shutdown, positions will be closed with 0 fees and 0 price impact. For more details, please refer to our{' '}
            <Link href="https://opyn.gitbook.io/opyn-strategies/strategies-faq/faq" passHref>
              <a className={classes.link} target="_blank" rel="noopener noreferrer">
                FAQ
              </a>
            </Link>{' '}
            and{' '}
            <Link href="https://opyn.gitbook.io/opyn-strategies/strategies-faq/faq" passHref>
              <a className={classes.link} target="_blank" rel="noopener noreferrer">
                Announcement
              </a>
            </Link>
            .
          </Typography>
        </div>
      </Alert>
    </div>
  )
}

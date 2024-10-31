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
            On {shutdownDateFormatted} the Squeeth protocol was shutdown.
          </Typography>

          <Typography variant="body2" className={classes.text} style={{ marginTop: theme.spacing(0.5) }}>
            Positions can be redeemed with 0 price impact by connecting your wallet. For more information, please refer
            to the{' '}
            <Link href="https://opyn.gitbook.io/opyn-hub/squeeth-retirement/squeeth-retirement-faqs" passHref>
              <a className={classes.link} target="_blank" rel="noopener noreferrer">
                Squeeth Shutdown FAQ
              </a>
            </Link>{' '}
            and{' '}
            <Link
              href="https://opyn.medium.com/our-beloved-squeeth-is-retiring-its-time-for-opyn-markets-to-take-over-1b66aad68f00"
              passHref
            >
              <a className={classes.link} target="_blank" rel="noopener noreferrer">
                Announcement
              </a>
            </Link>
            .
          </Typography>

          <Typography variant="body2" className={classes.text} style={{ marginTop: theme.spacing(0.5) }}>
            More announcements to come on the launch of Opyn Markets.
          </Typography>
        </div>
      </Alert>
    </div>
  )
}

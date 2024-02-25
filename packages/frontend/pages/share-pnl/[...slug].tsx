import { GetServerSideProps } from 'next'
import { NextSeo } from 'next-seo'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import { Typography, Button, useMediaQuery, useTheme } from '@material-ui/core'
import clsx from 'clsx'
import Image from 'next/image'
import isBefore from 'date-fns/isBefore'

import { SQUEETH_BASE_URL, BULL_START_DATE, CRABV2_START_DATE } from '@constants/index'
import Nav from '@components/Nav'
import { formatNumber } from '@utils/formatter'
import opynLogo from 'public/images/logo.png'
import crabLogo from 'public/images/crab-logo.png'
import zenBullLogo from 'public/images/zenbull-logo.png'
import PnlChart from '@components/SharePnl/PnlChart'
import { ROUTES } from '@constants/routes'

type StrategyType = 'crab' | 'zenbull'

interface SharePnlProps {
  strategy: StrategyType
  depositedAt: number
  pnl: number
}

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      maxWidth: '980px',
      width: '80%',
      padding: theme.spacing(6, 5),
      margin: '0 auto',
      [theme.breakpoints.down('lg')]: {
        width: '90%',
      },
      [theme.breakpoints.down('md')]: {
        width: '100%',
      },
      [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(3, 4),
      },
      [theme.breakpoints.down('xs')]: {
        padding: theme.spacing(3, 3),
      },
    },
    flex: {
      display: 'flex',
    },
    alignCenter: {
      alignItems: 'center',
    },
    alignBaseline: {
      alignItems: 'baseline',
    },
    justifyBetween: {
      justifyContent: 'space-between',
    },
    title: {
      fontSize: '36px',
      fontWeight: 500,
      lineHeight: '130%',
      letterSpacing: '-0.01em',
      [theme.breakpoints.down('sm')]: {
        fontSize: '28px',
      },
      [theme.breakpoints.down('xs')]: {
        fontSize: '24px',
      },
    },
    positionLabel: {
      fontSize: '18px',
      fontWeight: 700,
      lineHeight: '130%',
      [theme.breakpoints.down('sm')]: {
        fontSize: '16px',
      },
    },
    position: {
      fontSize: '36px',
      fontWeight: 500,
      lineHeight: '130%',
      letterSpacing: '-0.01em',
      fontFamily: 'DM Mono',
      [theme.breakpoints.down('sm')]: {
        fontSize: '28px',
      },
    },
    colorSuccess: {
      color: theme.palette.success.main,
    },
    colorError: {
      color: theme.palette.error.main,
    },
    positionUnit: {
      fontSize: '20px',
      fontWeight: 400,
      lineHeight: '130%',
      color: '#BABBBB',
      [theme.breakpoints.down('sm')]: {
        fontSize: '18px',
      },
    },
    textMargin: {
      marginLeft: theme.spacing(2),
    },
    sectionOutsetMargin: {
      marginTop: theme.spacing(6),
    },
    sectionInsetMargin: {
      marginTop: theme.spacing(1),
    },
    ctaButton: {
      fontSize: '16px',
      padding: theme.spacing(1, 3),
    },
  }),
)

// startDate can't be before the launch date of the strategy
const getStartTimestamp = (strategy: StrategyType, depositDate: Date) => {
  const crabV2LaunchDate = new Date(CRABV2_START_DATE)
  const zenBullLaunchDate = new Date(BULL_START_DATE)

  let startDate = depositDate
  if (strategy === 'crab' && isBefore(depositDate, crabV2LaunchDate)) {
    startDate = crabV2LaunchDate
  } else if (strategy === 'zenbull' && isBefore(depositDate, zenBullLaunchDate)) {
    startDate = zenBullLaunchDate
  }

  return startDate.getTime() / 1000
}

const UI = ({ strategy, depositedAt, pnl }: SharePnlProps) => {
  const theme = useTheme()
  const isMobileBreakpoint = useMediaQuery(theme.breakpoints.down('xs'))
  const classes = useStyles()

  const isCrab = strategy === 'crab'

  return (
    <>
      <Nav />

      <div className={classes.container}>
        <div className={clsx(classes.flex, classes.justifyBetween, classes.alignCenter)}>
          <div className={clsx(classes.flex, classes.alignCenter)}>
            <Image src={isCrab ? crabLogo : zenBullLogo} alt="opyn crab logo" height="32px" width="32px" />
            <Typography variant="h2" className={clsx(classes.title, classes.textMargin)}>
              {isCrab ? 'Crabber - Stacking USDC' : 'Zen Bull - Stacking ETH'}
            </Typography>
          </div>
          {!isMobileBreakpoint && <Image src={opynLogo} alt="opyn logo" width="80px" height="62px" />}
        </div>

        <div className={classes.sectionOutsetMargin}>
          <Typography className={classes.positionLabel}>
            {isCrab ? 'My Crab Position' : 'My Zen Bull Position'}
          </Typography>
          <div className={clsx(classes.flex, classes.alignBaseline, classes.sectionInsetMargin)}>
            <Typography className={clsx(classes.position, pnl >= 0 ? classes.colorSuccess : classes.colorError)}>
              {pnl > 0 && '+'}
              {formatNumber(pnl) + '%'}
            </Typography>
            <Typography className={clsx(classes.positionUnit, classes.textMargin)}>
              {isCrab ? 'USD Return' : 'ETH Return'}
            </Typography>
          </div>
        </div>

        <div className={classes.sectionOutsetMargin}>
          <PnlChart strategy={strategy} depositedAt={depositedAt} />
        </div>

        <div className={classes.sectionOutsetMargin}>
          <Button
            variant="outlined"
            color="primary"
            className={classes.ctaButton}
            href={isCrab ? ROUTES.STRATEGY.CRAB : ROUTES.STRATEGY.BULL}
          >
            Try {isCrab ? 'Crab' : 'Zen Bull'}
          </Button>
        </div>
      </div>
    </>
  )
}

const SharePnl = ({ strategy, depositedAt, pnl }: SharePnlProps) => {
  const isCrab = strategy === 'crab'

  const title = isCrab ? 'Opyn Crab Strategy - Stack USDC' : 'Opyn Zen Bull Strategy - Stack ETH'
  const description = isCrab ? 'Stack USDC when ETH is flat' : 'Stack ETH when ETH increases slow and steady'
  const ogImageUrl = SQUEETH_BASE_URL + '/api/pnl?strategy=' + strategy + '&depositedAt=' + depositedAt + '&pnl=' + pnl

  const depositDate = new Date(depositedAt * 1000)
  const startTimestamp = getStartTimestamp(strategy, depositDate)

  return (
    <>
      <NextSeo
        title={title}
        description={description}
        canonical={SQUEETH_BASE_URL}
        openGraph={{
          type: 'website',
          images: [
            {
              url: ogImageUrl,
              width: 1200,
              height: 630,
              alt: title,
            },
          ],
        }}
        twitter={{
          handle: '@opyn_',
          site: '@opyn_',
          cardType: 'summary_large_image',
        }}
      />

      <UI strategy={strategy} depositedAt={startTimestamp} pnl={pnl} />
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const slug = (context.query.slug as string[]) || []

  const strategy = slug[0] as StrategyType
  const depositedAt = slug[1]
  const pnl = slug[2]

  return { props: { strategy, depositedAt: Number(depositedAt), pnl: Number(pnl) } }
}

export default SharePnl

import { GetServerSideProps } from 'next'
import { NextSeo } from 'next-seo'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import { Box, Typography, CircularProgress, Button } from '@material-ui/core'
import clsx from 'clsx'
import Image from 'next/image'
import { isBefore, intervalToDuration, format } from 'date-fns'
import { useQuery } from 'react-query'
import HighchartsReact from 'highcharts-react-official'
import Highcharts from 'highcharts'

import { SQUEETH_BASE_URL, BULL_START_DATE, CRABV2_START_DATE } from '@constants/index'
import Nav from '@components/Nav'
import { formatNumber } from '@utils/formatter'
import { getCrabPnlV2ChartData, getBullChartData } from '@utils/pricer'
import opynLogo from 'public/images/logo.png'
import crabLogo from 'public/images/crab-logo.png'
import zenBullLogo from 'public/images/zenbull-logo.png'

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
    },
    positionLabel: {
      fontSize: '18px',
      fontWeight: 700,
      lineHeight: '130%',
    },
    position: {
      fontSize: '36px',
      fontWeight: 500,
      lineHeight: '130%',
      letterSpacing: '-0.01em',
      fontFamily: 'DM Mono',
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
    },
    loadingSpinner: {
      color: '#BABBBB',
      lineHeight: '130%',
    },
    loadingText: {
      fontSize: '18px',
      color: '#BABBBB',
      lineHeight: '130%',
    },
    textMargin: {
      marginLeft: theme.spacing(2),
    },
    sectionYMargin: {
      marginTop: theme.spacing(1),
    },
    chartLabel: {
      color: '#BABBBB',
      fontSize: '15px',
      fontWeight: 500,
      lineHeight: '140%',
      fontFamily: 'DM Mono',
    },
    ctaButton: {
      fontSize: '16px',
      padding: theme.spacing(1, 3),
    },
  }),
)

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

const formatDuration = (duration: Duration) => {
  const { years, months, days, hours } = duration
  const formattedDuration = []

  if (years) {
    formattedDuration.push(`${years}y`)
  }
  if (months) {
    formattedDuration.push(`${months}m`)
  }
  if (days) {
    formattedDuration.push(`${days}d`)
  }
  if (hours) {
    formattedDuration.push(`${hours}h`)
  }

  return formattedDuration.join(' ')
}

const pnlGraphOptions = {
  chart: {
    backgroundColor: 'none',
    zoomType: 'xy',
    height: '346',
    marginLeft: '0',
    style: {
      fontFamily: 'DM Mono',
    },
  },
  title: {
    text: '',
  },
  legend: {
    enabled: false,
    backgroundColor: '#343738',
    borderRadius: 10,
    itemStyle: {
      color: '#BABBBB',
    },
  },
  xAxis: {
    type: 'datetime',
    tickWidth: 0,
    lineWidth: 1,
    lineColor: '#8c8c8c',
    showFirstLabel: true,
    showLastLabel: true,
    plotLines: [
      {
        dashStyle: 'dot',
      },
    ],
    crosshair: {
      color: '#999',
    },
    labels: {
      enabled: false,
      style: {
        color: '#BABBBB',
      },
    },
  },
  tooltip: {
    shared: true,
    borderColor: 'none',
    style: {
      fontFamily: 'DM Mono',
    },
  },
  credits: {
    enabled: false,
  },
  exporting: {
    enabled: true,
  },
}

const useFetchPnlChartData = (strategy: StrategyType, depositTimestamp: number) => {
  return useQuery(
    ['pnlChartData', strategy, depositTimestamp],
    async () => {
      const endTimestamp = Math.floor(Date.now() / 1000)

      if (strategy === 'crab') {
        return getCrabPnlV2ChartData(depositTimestamp, endTimestamp).then((response) => {
          // console.log(response)
          return response.data?.map((x: Record<string, number>) => [x.timestamp * 1000, x.crabPnL * 100])
        })
      } else {
        return getBullChartData(depositTimestamp, endTimestamp).then((response) => {
          return response.data?.map((x: Record<string, number>) => [x.timestamp * 1000, x.bullEthPnl])
        })
      }
    },
    {
      staleTime: Infinity,
      refetchOnWindowFocus: true,
    },
  )
}

const PnlChart = ({ strategy, depositedAt }: { strategy: StrategyType; depositedAt: number }) => {
  const depositDate = new Date(depositedAt * 1000)
  const query = useFetchPnlChartData(strategy, depositedAt)

  const { isLoading, data } = query
  const classes = useStyles()

  if (isLoading) {
    return (
      <div className={clsx(classes.flex, classes.alignCenter)}>
        <CircularProgress size={15} className={classes.loadingSpinner} />
        <Typography className={clsx(classes.loadingText, classes.textMargin)}>Fetching data...</Typography>
      </div>
    )
  }

  const series = [
    {
      name: 'Crab/USDC 🦀  % Return',
      yAxis: 0,
      data: data || [],
      tooltip: {
        valueDecimals: 2,
        valueSuffix: '%',
      },
      color: '#70E3F6',
    },
  ]

  const axes = {
    yAxis: [
      {
        // Left yAxis
        lineColor: '#8c8c8c',
        dashStyle: 'Dash',
        lineWidth: 1,
        gridLineWidth: 0,
        minorGridLineWidth: 0,
        title: {
          text: strategy === 'crab' ? 'Crab Strategy' : 'Zen Bull Strategy',
          align: 'high',
          offset: 0,
          rotation: 0,
          y: 10,
          x: strategy === 'crab' ? 126 : 160,
          style: {
            color: '#BABBBB',
            fontSize: '14px',
          },
        },
        labels: {
          enabled: false,
          style: {
            color: '#BABBBB',
          },
        },
      },
    ],
  }

  const { chart, ...restOptions } = pnlGraphOptions

  const chartOptions = {
    ...restOptions,
    ...axes,
    chart: {
      ...chart,
      marginTop: '20',
      marginLeft: '1',
    },
    series: series,
  }

  const strategyDuration = intervalToDuration({ start: new Date(), end: depositDate })
  const formattedDuration = formatDuration(strategyDuration)

  return (
    <>
      <HighchartsReact highcharts={Highcharts} options={chartOptions} />
      <Typography className={classes.chartLabel}>
        {format(depositDate, 'MM/dd/yy')} (deposited {formattedDuration} ago)
      </Typography>
    </>
  )
}

const UI = ({ strategy, depositedAt, pnl }: SharePnlProps) => {
  const classes = useStyles()

  const isCrab = strategy === 'crab'
  const title = isCrab ? 'Crabber - Stacking USDC' : 'Zen Bull - Stacking ETH'

  return (
    <>
      <Nav />

      <div className={classes.container}>
        <div className={clsx(classes.flex, classes.justifyBetween, classes.alignCenter)}>
          <div className={clsx(classes.flex, classes.alignCenter)}>
            <Image src={isCrab ? crabLogo : zenBullLogo} alt="opyn crab logo" height="32px" width="32px" />
            <Typography variant="h2" className={clsx(classes.title, classes.textMargin)}>
              {title}
            </Typography>
          </div>
          <Image src={opynLogo} alt="opyn logo" width="80px" height="62px" />
        </div>

        <Box mt={6}>
          <Typography className={classes.positionLabel}>
            {isCrab ? 'My Crab Position' : 'My Zen Bull Position'}
          </Typography>
          <div className={clsx(classes.flex, classes.alignBaseline, classes.sectionYMargin)}>
            <Typography className={clsx(classes.position, pnl >= 0 ? classes.colorSuccess : classes.colorError)}>
              {pnl > 0 && '+'}
              {formatNumber(pnl) + '%'}
            </Typography>
            <Typography className={clsx(classes.positionUnit, classes.textMargin)}>
              {isCrab ? 'USD Return' : 'ETH Return'}
            </Typography>
          </div>
        </Box>

        <Box mt={6}>
          <PnlChart strategy={strategy} depositedAt={depositedAt} />
        </Box>

        <Box mt={6}>
          <Button
            variant="outlined"
            color="primary"
            className={classes.ctaButton}
            href={isCrab ? '/strategies' : '/strategies/zenbull'}
          >
            Try {isCrab ? 'Crab' : 'Zen Bull'}
          </Button>
        </Box>
      </div>
    </>
  )
}

const SharePnl = ({ strategy, depositedAt, pnl }: SharePnlProps) => {
  const isCrabStrategy = strategy === 'crab'

  const title = isCrabStrategy ? 'Opyn Crab Strategy - Stack USDC' : 'Opyn Zen Bull Strategy - Stack ETH'
  const description = isCrabStrategy ? 'Stack USDC when ETH is flat' : 'Stack ETH when ETH increases slow and steady'
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
  const { strategy, depositedAt, pnl } = context.query
  return { props: { strategy, depositedAt: Number(depositedAt), pnl: Number(pnl) } }
}

export default SharePnl

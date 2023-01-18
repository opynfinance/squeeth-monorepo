import { Typography, CircularProgress } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import clsx from 'clsx'
import { intervalToDuration, format } from 'date-fns'
import { useQuery } from 'react-query'
import HighchartsReact from 'highcharts-react-official'
import Highcharts from 'highcharts'

import { getCrabPnlV2ChartData, getBullChartData } from '@utils/pricer'

type StrategyType = 'crab' | 'zenbull'

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
    marginTop: '20',
    marginLeft: '40',
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
  yAxis: {
    title: {
      text: '',
    },
    labels: {
      style: {
        color: '#BABBBB',
      },
    },
    gridLineColor: 'rgba(221,221,221,0.1)',
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

const useStyles = makeStyles((theme) =>
  createStyles({
    flex: {
      display: 'flex',
    },
    alignCenter: {
      alignItems: 'center',
    },
    alignStart: {
      alignItems: 'flex-start',
    },
    loadingContainer: {
      height: '368px',
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
    chartLabel: {
      color: '#BABBBB',
      fontSize: '15px',
      fontWeight: 500,
      lineHeight: '140%',
      fontFamily: 'DM Mono',
      marginLeft: '36px',
    },
  }),
)

const useFetchPnlChartData = (strategy: StrategyType, depositTimestamp: number) => {
  return useQuery(
    ['pnlChartData', strategy, depositTimestamp],
    async () => {
      const endTimestamp = Math.floor(Date.now() / 1000)

      if (strategy === 'crab') {
        return getCrabPnlV2ChartData(depositTimestamp, endTimestamp).then((response) => {
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
      <div className={clsx(classes.flex, classes.alignStart, classes.loadingContainer)}>
        <div className={clsx(classes.flex, classes.alignCenter)}>
          <CircularProgress size={15} className={classes.loadingSpinner} />
          <Typography className={clsx(classes.loadingText, classes.textMargin)}>Fetching data...</Typography>
        </div>
      </div>
    )
  }

  const isCrab = strategy === 'crab'

  const series = [
    {
      name: isCrab ? 'Crab/USDC 🦀  % Return' : 'Bull/ETH 🧘🐂 % Return',
      yAxis: 0,
      data: data || [],
      tooltip: {
        valueDecimals: 2,
        valueSuffix: '%',
      },
      color: '#70E3F6',
    },
  ]

  const chartOptions = {
    ...pnlGraphOptions,
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

export default PnlChart

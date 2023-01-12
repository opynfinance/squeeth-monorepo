import { Box, CircularProgress } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React, { memo, useEffect } from 'react'
import useAppMemo from '@hooks/useAppMemo'
import {
  crabv2StrategyFilterEndDateAtom,
  crabv2StrategyFilterStartDateAtom,
  useCrabPnLV2ChartData,
} from 'src/state/crab/atoms'
import { pnlGraphOptions } from '@constants/diagram'
import HighchartsReact from 'highcharts-react-official'
import Highcharts from 'highcharts'
import Grid from '@material-ui/core/Grid'
import DateFnsUtils from '@date-io/date-fns'
import { DatePicker, MuiPickersUtilsProvider } from '@material-ui/pickers'
import { CRABV2_START_DATE } from '@constants/index'
import { useAtom } from 'jotai'

export type ChartDataInfo = {
  timestamp: number
  crabPnL: number
}

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(0),
      marginTop: theme.spacing(4),
      marginBottom: theme.spacing(1),
      maxWidth: '640px',
    },
    chartContainer: {
      borderRadius: theme.spacing(1),
      padding: theme.spacing(1, 0),
      display: 'flex',
      marginTop: theme.spacing(2),
      [theme.breakpoints.up('sm')]: {
        maxHeight: '310px',
      },
      [theme.breakpoints.down('sm')]: {
        flexDirection: 'column',
      },
    },
    navDiv: {
      display: 'flex',
      marginBottom: theme.spacing(2),
      marginTop: theme.spacing(2),
      alignItems: 'center',
    },
    grid: {
      rowGap: '24px',
      columnGap: '24px',
      marginRight: 'auto',
      padding: theme.spacing(2),
    },
  }),
)

function CrabStrategyV2PnLChart() {
  const classes = useStyles()

  const minDate = CRABV2_START_DATE
  const [startDate, setStartDate] = useAtom(crabv2StrategyFilterStartDateAtom)
  const [endDate, setEndDate] = useAtom(crabv2StrategyFilterEndDateAtom)

  const query = useCrabPnLV2ChartData()

  const crabUsdPnlSeries = query?.data?.data.map((x: ChartDataInfo) => [x.timestamp * 1000, x.crabPnL * 100])

  useEffect(() => {
    Highcharts.setOptions({
      lang: {
        thousandsSep: ',',
      },
    })
  }, [])

  const series = [
    {
      name: 'Crab/USD 🦀  % Return',
      yAxis: 0,
      data: crabUsdPnlSeries,
      tooltip: {
        valueDecimals: 2,
        valueSuffix: '%',
      },
      color: '#70E3F6',
    }
  ]

  const axes = {
    yAxis: [
      {
        // Left yAxis
        title: {
          text: '',
        },
        labels: {
          style: {
            color: '#BABBBB',
          },
        },
        gridLineColor: 'rgba(221,221,221,0.1)',
      }
    ],
  }

  const chartOptions = useAppMemo(() => {
    return {
      ...pnlGraphOptions,
      series: series,
      ...axes,
    }
  })

  return (
    <>
      <MuiPickersUtilsProvider utils={DateFnsUtils}>
        <Grid container className={classes.grid}>
          <DatePicker
            label="Start Date"
            placeholder="MM/DD/YYYY"
            format={'MM/dd/yyyy'}
            value={startDate}
            minDate={minDate}
            onChange={(d) => setStartDate(d || new Date())}
            animateYearScrolling={false}
            autoOk={true}
            clearable
          />

          <DatePicker
            label="End Date"
            placeholder="MM/DD/YYYY"
            format={'MM/dd/yyyy'}
            value={endDate}
            minDate={startDate}
            onChange={(d) => setEndDate(d || new Date())}
            animateYearScrolling={false}
            autoOk={true}
            clearable
          />
        </Grid>
      </MuiPickersUtilsProvider>

      <div className={classes.chartContainer} style={{ maxHeight: 'none' }}>
        <div style={{ flex: '1 1 0', marginTop: '8px' }}>
          {crabUsdPnlSeries ? (
            <HighchartsReact highcharts={Highcharts} options={chartOptions} />
          ) : (
            <Box display="flex" height="300px" width={1} alignItems="center" justifyContent="center">
              <CircularProgress size={40} color="secondary" />
            </Box>
          )}
        </div>
      </div>
    </>
  )
}

const ChartMemoized = memo(CrabStrategyV2PnLChart)

export { ChartMemoized as CrabStrategyV2PnLChart }

import { Button, ButtonGroup, createStyles, makeStyles, TextField } from '@material-ui/core'
import dynamic from 'next/dynamic'
import React, { useEffect, useMemo, useState } from 'react'

import { graphOptions } from '../../constants/diagram'
import { useWorldContext } from '../../context/world'
import IV from '../IV'
import { SqueethTab, SqueethTabs } from '../Tabs'

enum ChartType {
  PNL = 'LONG PNL',
  Price = 'Price Chart',
  PositionSize = 'Position Size',
  Funding = 'Funding Payment',
}

const Chart = dynamic(() => import('kaktana-react-lightweight-charts'), { ssr: false })

const useStyles = makeStyles((theme) =>
  createStyles({
    navDiv: {
      display: 'flex',
      marginBottom: theme.spacing(3),
    },
    chartNav: {
      border: `1px solid ${theme.palette.primary.main}30`,
    },
  }),
)

export function LongChart() {
  const [mode, setMode] = useState<ChartType>(ChartType.PNL)
  const [tradeType, setTradeType] = useState(0)

  const classes = useStyles()

  useEffect(() => {
    if (tradeType === 0) setMode(ChartType.PNL)
    else if (tradeType === 1) setMode(ChartType.Price)
    else if (tradeType === 2) setMode(ChartType.Funding)
  }, [tradeType])

  const {
    researchMode,
    ethPrices,
    longEthPNL,
    squeethPrices,
    longSeries,
    days,
    setDays,
    positionSizeSeries,
    fundingPercentageSeries,
  } = useWorldContext()

  // plot line data
  const lineSeries = useMemo(() => {
    if (mode === ChartType.Price)
      return [
        { data: ethPrices, legend: 'ETH' },
        { data: squeethPrices, legend: 'Squeeth' },
      ]
    if (mode === ChartType.PNL)
      return [
        { data: longEthPNL, legend: 'Long 1 ETH PNL' },
        { data: longSeries, legend: 'Long 1 Squeeth PNL (incl. funding)' },
      ]
    if (mode === ChartType.PositionSize) return [{ data: positionSizeSeries, legend: 'Position Size' }]
    if (mode === ChartType.Funding)
      return [{ data: fundingPercentageSeries, legend: 'Daily Funding (paid continuously out of your position)' }]
    return []
  }, [mode, longSeries, squeethPrices, ethPrices, longEthPNL, positionSizeSeries, fundingPercentageSeries])

  const chartOptions = useMemo(() => {
    if (mode === ChartType.Funding || mode === ChartType.PositionSize)
      return {
        ...graphOptions,
        localization: {
          priceFormatter: (num: number) => num + '%',
        },
      }
    return graphOptions
  }, [mode])

  const startTimestamp = useMemo(
    () => (lineSeries.length > 0 && lineSeries[0].data.length > 0 ? lineSeries[0].data[0].time : 0),
    [lineSeries],
  )

  const endTimestamp = useMemo(
    () =>
      lineSeries.length > 0 && lineSeries[0].data.length > 0
        ? lineSeries[0].data[lineSeries[0].data.length - 1].time
        : 0,
    [lineSeries],
  )

  return (
    <div>
      {/* show button tabs and enable price chart only during research mode */}
      {/* {researchMode && ( */}
      <div className={classes.navDiv}>
        <SqueethTabs
          style={{ background: 'transparent' }}
          className={classes.chartNav}
          value={tradeType}
          onChange={(evt, val) => setTradeType(val)}
          aria-label="Sub nav tabs"
        >
          <SqueethTab label={`${days}D PNL`} />
          <SqueethTab label="Price" />
          <SqueethTab label="Funding" />
        </SqueethTabs>
      </div>

      {/* <ButtonGroup color="primary" aria-label="outlined primary button group">
        <Button
          style={{ textTransform: 'none' }}
          onClick={() => setMode(ChartType.PNL)}
          variant={mode === ChartType.PNL ? 'outlined' : 'contained'}
        >
          {' '}
          {days}D PNL{' '}
        </Button>
        <Button
          style={{ textTransform: 'none' }}
          onClick={() => setMode(ChartType.Price)}
          variant={mode === ChartType.Price ? 'outlined' : 'contained'}
        >
          {' '}
          Price{' '}
        </Button>
        <Button
          style={{ textTransform: 'none' }}
          onClick={() => setMode(ChartType.Funding)}
          variant={mode === ChartType.Funding ? 'outlined' : 'contained'}
        >
          {' '}
          Funding{' '}
        </Button>
      </ButtonGroup> */}
      <Chart
        from={startTimestamp}
        to={endTimestamp}
        legend={mode}
        options={chartOptions}
        lineSeries={lineSeries}
        autoWidth
        height={300}
        darkTheme
      />
      <br />
      <div style={{ marginBottom: '16px' }}>
        <TextField
          onChange={(event) => setDays(parseInt(event.target.value))}
          size="small"
          value={days}
          type="number"
          style={{ width: 300 }}
          label="Historical Days"
          variant="outlined"
        />
      </div>
      {/* <IV /> */}
    </div>
  )
}

import React, { useState, useMemo } from 'react'
import { ButtonGroup, Button, TextField } from '@material-ui/core'
import dynamic from 'next/dynamic'

import { useWorldContext } from '../../context/world'
import { graphOptions } from '../../constants/diagram'

enum ChartType {
  PNL = 'LONG PNL',
  Price = 'Price Chart',
  PositionSize = 'Position Size',
  Funding = 'Funding Payment',
}

const Chart = dynamic(
  () => import('kaktana-react-lightweight-charts'),
  { ssr: false }
)

export function LongChart() {

  const [mode, setMode] = useState<ChartType>(ChartType.PNL)

  const { researchMode, ethPrices, longEthPNL, squeethPrices, longSeries, days, setDays, positionSizeSeries, fundingPercentageSeries } = useWorldContext()

  // plot line data
  const lineSeries = useMemo(() => {
    if (mode === ChartType.Price) return [{ data: ethPrices, legend: 'ETH' }, { data: squeethPrices, legend: 'Continuous Call' }]
    if (mode === ChartType.PNL) return [{ data: longEthPNL, legend: 'Long 1 ETH' }, { data: longSeries, legend: 'Long 1 Continuous Call' }]
    if (mode === ChartType.PositionSize) return [{ data: positionSizeSeries, legend: 'Position Size' }]
    if (mode === ChartType.Funding) return [{ data: fundingPercentageSeries, legend: 'Daily Funding' }]
    return []
  },
    [mode, longSeries, squeethPrices, ethPrices, longEthPNL, positionSizeSeries, fundingPercentageSeries]
  )

  const chartOptions = useMemo(() => {
    if (mode === ChartType.Funding || mode === ChartType.PositionSize ) return {
      ...graphOptions,
      localization: {
        priceFormatter: (num: number) => num + '%'
      }
    }
    return graphOptions
  }, [mode])


  const startTimestamp = useMemo(() => lineSeries.length > 0 && lineSeries[0].data.length > 0
    ? lineSeries[0].data[0].time
    : 0,
    [lineSeries]
  )

  const endTimestamp = useMemo(() => lineSeries.length > 0 && lineSeries[0].data.length > 0
    ? lineSeries[0].data[lineSeries[0].data.length - 1].time
    : 0,
    [lineSeries]
  )


  return (
    <div>
      {/* show button tabs and enable price chart only during research mode */}
      {researchMode && <ButtonGroup color="primary" aria-label="outlined primary button group">
        <Button style={{ textTransform: 'none' }} onClick={() => setMode(ChartType.PNL)} variant={mode === ChartType.PNL ? 'contained' : 'outlined'}> {days}D PNL </Button>
        <Button style={{ textTransform: 'none' }} onClick={() => setMode(ChartType.Price)} variant={mode === ChartType.Price ? 'contained' : 'outlined'}> Price </Button>
        <Button style={{ textTransform: 'none' }} onClick={() => setMode(ChartType.PositionSize)} variant={mode === ChartType.PositionSize ? 'contained' : 'outlined'}> Size </Button>
        <Button style={{ textTransform: 'none' }} onClick={() => setMode(ChartType.Funding)} variant={mode === ChartType.Funding ? 'contained' : 'outlined'}> Funding </Button>

      </ButtonGroup>}
      <Chart
        from={startTimestamp}
        to={endTimestamp}
        legend={mode}
        options={chartOptions}
        lineSeries={lineSeries}
        autoWidth
        height={300}
      />
      <br />
      <TextField
        onChange={(event) => setDays(parseInt(event.target.value))}
        size="small"
        value={days}
        type="number"
        style={{ width: 300 }}
        label="Back Test Days"
        variant="outlined" />
    </div>
  )
}

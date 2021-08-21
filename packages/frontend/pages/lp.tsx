import { Button, ButtonGroup, Container, TextField } from '@material-ui/core'
import dynamic from 'next/dynamic'
import React, { useEffect, useMemo, useState } from 'react'

import Nav from '../src/components/Nav'
import { graphOptions } from '../src/constants/diagram'
import { useWorldContext } from '../src/context/world'
import useAsyncMemo from '../src/hooks/useAsyncMemo'
import { useETHPriceCharts } from '../src/hooks/useETHPriceCharts'
import { getFairSqueethMarkAfter, getVolForTimestampOrDefault, getVolMap } from '../src/utils'

enum ChartType {
  Price = 'Price ($)',
  RelativePrice = 'Price (ETH)',
  IL = 'Impermanent Loss',
  Fee = 'Fee',
  PNL = 'LP PNL',
}

const Chart = dynamic(() => import('kaktana-react-lightweight-charts'), { ssr: false })

export function LPCalculator() {
  const [mode, setMode] = useState<ChartType>(ChartType.IL)

  const [endDate, setEndDate] = useState<Date>(new Date())

  // default to 100 days
  const [startDate, setStartDate] = useState<Date>(new Date(Date.now() - 86400 * 1000 * 100))

  const daysBack = useMemo(() => {
    return Math.floor((Date.now() - startDate.getTime()) / (86400 * 1000))
  }, [startDate])

  const { setDays, ethPrices: rawEthPrices, squeethPrices: rawSqueethPrices } = useETHPriceCharts(100)

  // use global vol multiplier
  const { volMultiplier } = useWorldContext()

  // inefficient way to cut price series to only required period.
  const squeethPrices = useMemo(() => {
    return rawSqueethPrices.filter((entry) => entry.time < endDate.getTime())
  }, [rawSqueethPrices, endDate])

  const ethPrices = useMemo(() => {
    return rawEthPrices.filter((entry) => entry.time < endDate.getTime())
  }, [rawEthPrices, endDate])

  const squeethPricesInETH = useMemo(() => {
    if (squeethPrices.length !== ethPrices.length) return []

    return squeethPrices.map(({ time, value }, i) => {
      return {
        time: time,
        value: (value / ethPrices[i].value) * 100,
      }
    })
  }, [ethPrices, squeethPrices])

  const squeethMarkPricesInEth = useAsyncMemo(
    async () => {
      return getMarkPriceSeriesInEth(ethPrices, volMultiplier)
    },
    [],
    [ethPrices, volMultiplier],
  )

  const ImpermanentLossSeries = useMemo(() => {
    return squeethMarkPricesInEth.map(({ time, value }, i) => {
      return {
        time: time,
        value: calculateIL(value) * 100,
      }
    })
  }, [squeethMarkPricesInEth])

  const aggregatedFeeSeries = useMemo(() => {
    return getAggregatedFees(squeethPricesInETH)
  }, [squeethPricesInETH])

  useEffect(() => {
    setDays(daysBack)
  }, [daysBack, setDays])

  const lineSeries = useMemo(() => {
    if (mode === ChartType.Price)
      return [
        { data: ethPrices, legend: 'ETH' },
        { data: squeethPrices, legend: 'Squeeth price (normalized)' },
      ]
    if (mode === ChartType.RelativePrice) return [{ data: squeethPricesInETH, legend: 'squeeth price in eth' }]
    if (mode === ChartType.IL) return [{ data: ImpermanentLossSeries, legend: 'Impermanent Loss' }]
    if (mode === ChartType.Fee)
      return [
        { data: aggregatedFeeSeries.aggregated, legend: 'Aggregated Fee' },
        { data: aggregatedFeeSeries.fees, legend: 'Daily Fee' },
      ]
    return []
  }, [mode, squeethPrices, ethPrices, squeethPricesInETH, ImpermanentLossSeries, aggregatedFeeSeries])

  const chartOptions = useMemo(() => {
    if (mode === ChartType.IL || mode === ChartType.RelativePrice)
      return {
        ...graphOptions,
        localization: {
          priceFormatter: (num: number) => num + '%',
        },
      }
    if (mode === ChartType.Fee)
      return {
        ...graphOptions,
        localization: {
          priceFormatter: (num: number) => num + ' ETH',
        },
      }
    return graphOptions
  }, [mode])

  return (
    <Container>
      <Nav />
      <div style={{ justifyContent: 'center', textAlign: 'center', paddingTop: 30 }}>
        <h1> LP Calculator </h1>

        <div style={{ padding: 10, opacity: 0.7, fontSize: 18 }}> AMM LP Analysis 🧑‍💻</div>
        <br />
        <div>
          <TextField
            value={toDateString(startDate)}
            type="date"
            helperText="start"
            style={{ paddingRight: 15 }}
            onChange={(event) => {
              setStartDate(new Date(event.target.value))
            }}
          />
          <TextField
            value={toDateString(endDate)}
            type="date"
            helperText="end"
            style={{ paddingRight: 15 }}
            onChange={(event) => {
              setEndDate(new Date(event.target.value))
            }}
          />
        </div>

        <div style={{ padding: 20 }}>
          <ButtonGroup color="primary" aria-label="outlined primary button group">
            <Button
              style={{ textTransform: 'none' }}
              onClick={() => setMode(ChartType.Price)}
              variant={mode === ChartType.Price ? 'contained' : 'outlined'}
            >
              {' '}
              Price in ${' '}
            </Button>
            <Button
              style={{ textTransform: 'none' }}
              onClick={() => setMode(ChartType.RelativePrice)}
              variant={mode === ChartType.RelativePrice ? 'contained' : 'outlined'}
            >
              {' '}
              Price in ETH{' '}
            </Button>
            <Button
              style={{ textTransform: 'none' }}
              onClick={() => setMode(ChartType.IL)}
              variant={mode === ChartType.IL ? 'contained' : 'outlined'}
            >
              {' '}
              Impermanent Loss{' '}
            </Button>
            <Button
              style={{ textTransform: 'none' }}
              onClick={() => setMode(ChartType.Fee)}
              variant={mode === ChartType.Fee ? 'contained' : 'outlined'}
            >
              {' '}
              Minimal Fee{' '}
            </Button>
          </ButtonGroup>
        </div>

        <Chart
          from={startDate.getTime() / 1000}
          to={endDate.getTime() / 1000}
          legend={mode}
          options={chartOptions}
          lineSeries={lineSeries}
          autoWidth
          height={300}
          darkTheme
        />

        <div>
          {mode === ChartType.Fee && (
            <p>
              {' '}
              Minimal fee is calculated by the following assumption: <br />
              - 0.3% fee rate <br />
              - the pool start with 1 eth and 1 squeeth <br />- arbitragers pay the fee and bring the squeeth / eth
              price at every interval
            </p>
          )}
        </div>
      </div>
    </Container>
  )
}

function toDateString(date: Date) {
  return date.toISOString().split('T')[0]
}

/**
 * eth start price is 1
 * squeeth start price is 1
 * @param squeethPriceInEth
 */
function calculateIL(squeethPriceInEth: number) {
  console.log(`squeethPriceInEth`, squeethPriceInEth)
  // started with x, y = 1
  const x0 = 1 // eth amount 1
  const y0 = 1 // squeeth amount 1
  const k = x0 * y0

  // x: eth amount
  // y: squeeth amount

  // x * y = k
  // x / y = squeethPriceInEth

  // y^2 * squeethPriceInEth = k
  const y1 = Math.sqrt(k / squeethPriceInEth)
  const x1 = k / y1

  const newValue = x1 * 1 + y1 * squeethPriceInEth

  const oldValue = x0 * 1 + y0 * squeethPriceInEth
  const il = (oldValue - newValue) / oldValue

  return il
}

function getAggregatedFees(squeethPricesInEth: { value: number; time: number }[], feeRate = 0.003) {
  let aggregatedFee = 0
  let lastY = 1
  let lastX = 1
  const aggregated = [] as { time: number; value: number }[]
  const fees = [] as { time: number; value: number }[]
  squeethPricesInEth.forEach(({ value: squeethPriceInEthPercentage, time }) => {
    const squeethPriceInEth = squeethPriceInEthPercentage / 100
    const y1 = Math.sqrt(1 / squeethPriceInEth)
    const x1 = 1 / y1

    let fee = 0

    if (y1 > lastY) {
      // charge fee in squeeth
      fee = (y1 - lastY) * squeethPriceInEth * feeRate
      aggregatedFee += fee
    }
    if (x1 > lastX) {
      fee = (x1 - lastX) * feeRate
      aggregatedFee += fee
    }

    lastX = x1
    lastY = y1

    aggregated.push({
      value: aggregatedFee,
      time,
    })

    fees.push({
      value: fee,
      time,
    })
  })

  return { aggregated, fees }
}

async function getMarkPriceSeriesInEth(ethPrices: { value: number; time: number }[], volMultiplier: number) {
  if (ethPrices.length === 0) return []

  let lastTime = ethPrices[0].time
  const startingEthPrice = ethPrices[0].value
  const volsMap = await getVolMap()

  const result: { time: number; value: number }[] = []

  for (const { value: price, time } of ethPrices) {
    const vol = (await getVolForTimestampOrDefault(volsMap, time, price)) * volMultiplier

    const timeElapsed = (time - lastTime) / 86400 // time since last action, in day
    lastTime = time

    // const markB = getFairSqueethMarkBefore(price, timeElapsed, vol) / startingEthPrice;
    const mark = getFairSqueethMarkAfter(price, timeElapsed, vol) / startingEthPrice

    result.push({ value: mark / price, time })
  }

  return result
}

export default LPCalculator

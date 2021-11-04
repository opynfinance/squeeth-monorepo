import { Button, ButtonGroup, createStyles, Hidden, makeStyles, TextField, Typography } from '@material-ui/core'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import React, { useEffect, useMemo, useState } from 'react'

import ComparisonChart from '../../../public/images/ComparisonChart.svg'
import { graphOptions } from '../../constants/diagram'
import { useWorldContext } from '../../context/world'
import { useETHPrice } from '../../hooks/useETHPrice'
import IV from '../IV'
import { SqueethTab, SqueethTabs } from '../Tabs'
import LongSqueethPayoff from './LongSqueethPayoff'

enum ChartType {
  PNL = 'LONG PNL',
  // Price = 'Price Chart',
  PositionSize = 'Position Size',
  // Funding = 'Funding Payment',
  Payoff = 'Payoff',
  // Comparison = 'Comparison',
  Details = 'Details',
}

const Chart = dynamic(() => import('kaktana-react-lightweight-charts'), { ssr: false })

const useStyles = makeStyles((theme) =>
  createStyles({
    navDiv: {
      display: 'flex',
      marginBottom: theme.spacing(2),
      alignItems: 'center',
    },
    chartNav: {
      border: `1px solid ${theme.palette.primary.main}30`,
    },
    cardDetail: {
      color: theme.palette.text.secondary,
      lineHeight: '1.75rem',
      fontSize: '16px',
      marginTop: theme.spacing(2),
      maxWidth: '800px',
    },
    cardTitle: {
      color: theme.palette.primary.main,
    },
    header: {
      color: theme.palette.primary.main,
    },
    payoffContainer: {
      display: 'flex',
      overflow: 'auto',
      maxHeight: '310px',
    },
  }),
)

export function LongChart() {
  const [mode, setMode] = useState<ChartType>(ChartType.PNL)
  const [tradeType, setTradeType] = useState(0)

  const classes = useStyles()
  const ethPrice = useETHPrice()

  useEffect(() => {
    if (tradeType === 0) setMode(ChartType.PNL)
    // else if (tradeType === 1) setMode(ChartType.Price)
    // else if (tradeType === 1) setMode(ChartType.Funding)
    else if (tradeType === 1) setMode(ChartType.Payoff)
    // else if (tradeType === 3) setMode(ChartType.Comparison)
    else if (tradeType === 2) setMode(ChartType.Details)
  }, [tradeType])

  const {
    startingETHPrice,
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
    // if (mode === ChartType.Price)
    //   return [
    //     { data: ethPrices, legend: 'ETH' },
    //     { data: squeethPrices, legend: 'Squeeth' },
    //   ]
    if (mode === ChartType.PNL)
      return [
        { data: convertPNLToPriceChart(longEthPNL, startingETHPrice), legend: 'Long 1 ETH PNL' },
        { data: convertPNLToPriceChart(longSeries, startingETHPrice), legend: 'Long 1 Squeeth PNL (incl. funding)' },
      ]
    if (mode === ChartType.PositionSize) return [{ data: positionSizeSeries, legend: 'Position Size' }]
    // if (mode === ChartType.Funding)
    //   return [{ data: fundingPercentageSeries, legend: 'Daily Funding (paid continuously out of your position)' }]
    return []
  }, [mode, longSeries, squeethPrices, ethPrices, longEthPNL, positionSizeSeries, fundingPercentageSeries])

  const chartOptions = useMemo(() => {
    // if (mode === ChartType.Funding || mode === ChartType.PositionSize)
    if (mode === ChartType.PositionSize)
      return {
        ...graphOptions,
        localization: {
          priceFormatter: (num: number) => num + '%',
        },
      }
    return { ...graphOptions, priceScale: { mode: 2 } }
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
    <>
      {/* show button tabs and enable price chart only during research mode */}
      {/* {researchMode && ( */}
      <div className={classes.navDiv}>
        <SqueethTabs
          style={{ background: 'transparent' }}
          className={classes.chartNav}
          value={tradeType}
          onChange={(evt, val) => setTradeType(val)}
          aria-label="Sub nav tabs"
          scrollButtons="auto"
          variant="scrollable"
        >
          <SqueethTab label={`Historical ${days}D PNL`} />
          {/* <SqueethTab label="Price" /> */}
          {/* <SqueethTab label="Funding" /> */}
          <SqueethTab label="Payoff" />
          {/* <SqueethTab label="Comparison" /> */}
          <SqueethTab label="Details" />
        </SqueethTabs>
        <Hidden smDown>
          {mode === ChartType.PNL ? (
            <TextField
              onChange={(event) => setDays(parseInt(event.target.value))}
              size="small"
              value={days}
              type="number"
              style={{ width: 150, marginLeft: '16px' }}
              label="Historical Days"
              variant="outlined"
            />
          ) : null}
        </Hidden>
      </div>

      {mode === ChartType.Payoff ? (
        <div className={classes.payoffContainer}>
          <LongSqueethPayoff ethPrice={ethPrice.toNumber()} />
          <Hidden smDown>
            <Image src={ComparisonChart} alt="Comparison Chart" height={340} width={600} />
          </Hidden>
        </div>
      ) : mode === ChartType.Details ? (
        <div style={{ overflow: 'auto', maxHeight: '370px' }}>
          <Typography className={classes.cardTitle} variant="h6">
            What is squeeth?
          </Typography>
          <Typography variant="body2" className={classes.cardDetail}>
            Long squeeth (ETH&sup2;) gives you a leveraged position with unlimited upside, protected downside, and no
            liquidations. Compared to a 2x leveraged position, you make more when ETH goes up and lose less when ETH
            goes down (excluding funding). Eg. If ETH goes up 5x, squeeth goes up 25x. You pay a funding rate for this
            position. Enter the position by purchasing an ERC20 token.{' '}
            <a
              className={classes.header}
              href="https://opynopyn.notion.site/Squeeth-FAQ-4b6a054ab011454cbbd60cb3ee23a37c"
            >
              {' '}
              Learn more.{' '}
            </a>
          </Typography>
          <Typography className={classes.cardTitle} variant="h6">
            Risks
          </Typography>
          <Typography variant="body2" className={classes.cardDetail}>
            Funding is paid out of your position, meaning you sell a small amount of squeeth at funding, reducing your
            position size. Holding the position for a long period of time without upward movements in ETH can lose
            considerable funds to funding payments.
            <br /> <br />
            Squeeth smart contracts are currently unaudited. This is experimental technology and we encourage caution
            only risking funds you can afford to lose.
            <br /> <br />
            If ETH goes down considerably, you may lose some or all of your initial investment.
          </Typography>
        </div>
      ) : (
        // : mode === ChartType.Comparison ? (
        //   <Image src={ComparisonChart} alt="Comparison Chart" height={340} />
        // )
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
      )}
    </>
  )
}

const convertPNLToPriceChart = (pnlSeries: { time: number; value: number }[], startingCapital: number) => {
  return pnlSeries.map(({ value, time }) => {
    return {
      value: value + startingCapital,
      time,
    }
  })
}

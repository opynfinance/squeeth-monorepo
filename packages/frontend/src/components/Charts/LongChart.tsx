import {
  Box,
  createStyles,
  Hidden,
  InputAdornment,
  makeStyles,
  TextField,
  Tooltip,
  Typography,
  CircularProgress,
} from '@material-ui/core'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import { atom, useAtom, useAtomValue } from 'jotai'
import React, { memo } from 'react'

import ComparisonChart from '../../../public/images/ComparisonChart.svg'
import { graphOptions } from '../../constants/diagram'
import { Links, Tooltips } from '../../constants/enums'
import { SqueethTab, SqueethTabs } from '../Tabs'
import LongSqueethPayoff from './LongSqueethPayoff'
import FundingChart from './FundingChart'
import { useETHPrice } from '@hooks/useETHPrice'
import { daysAtom, useLongChartData } from 'src/state/ethPriceCharts/atoms'
import LegendBox from '@components/LegendBox'
import useAppMemo from '@hooks/useAppMemo'
enum ChartType {
  PNL = 'LONG PNL',
  // Price = 'Price Chart',
  PositionSize = 'Position Size',
  // Funding = 'Funding Payment',
  Payoff = 'Payoff',
  // Comparison = 'Comparison',
  Details = 'Details',
  Risks = 'Risks',
  Funding = 'Premium',
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
      marginTop: theme.spacing(1),
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
      [theme.breakpoints.up('sm')]: {
        maxHeight: '310px',
      },
      [theme.breakpoints.down('sm')]: {
        flexDirection: 'column',
      },
    },
    intro: {
      marginTop: '2em',
      [theme.breakpoints.up('md')]: {
        marginTop: 0,
        width: '300px',
        marginLeft: '20px',
      },
    },
    infoIcon: {
      fontSize: '1rem',
      marginLeft: theme.spacing(0.5),
      marginTop: '2px',
    },
    legendBox: {
      display: 'flex',
      gap: '10px',
      marginTop: '10px',
      justifyContent: 'center',
    },
  }),
)

const chartTradeTypeAtom = atom(0)

const modeAtom = atom<ChartType>((get) => {
  const tradeType = get(chartTradeTypeAtom)

  if (tradeType === 0) return ChartType.PNL
  else if (tradeType === 1) return ChartType.Payoff
  else if (tradeType === 2) return ChartType.Funding
  else if (tradeType === 3) return ChartType.Risks

  return ChartType.PNL
})

function LongChart() {
  const classes = useStyles()
  const ethPrice = useETHPrice()
  const [days, setDays] = useAtom(daysAtom)
  const mode = useAtomValue(modeAtom)
  const [tradeType, setTradeType] = useAtom(chartTradeTypeAtom)
  const query = useLongChartData()

  const longEthPNL = query.data?.longEthPNL
  const longSeries = query.data?.longSeries
  const positionSizeSeries = query.data?.positionSizeSeries
  const squeethIsLive = query.data?.squeethIsLive

  // plot line data
  const lineSeries = useAppMemo(() => {
    if (!longEthPNL || !longSeries || longSeries.length === 0 || !positionSizeSeries || !squeethIsLive) return

    const liveIndex = Math.max(
      0,
      squeethIsLive.findIndex((val: boolean) => val),
    ) // return 0 when there is no live data

    if (mode === ChartType.PNL)
      return [
        { data: longEthPNL, legend: 'Long ETH PNL (%)' },
        {
          data: longSeries.slice(0, liveIndex),
          legend: `Long Squeeth PNL (%) Simulated incl. premiums`,
        },
        {
          data: longSeries.slice(liveIndex),
          legend: `Long Squeeth PNL (%) LIVE (incl. premiums)`,
        },
      ]
    if (mode === ChartType.PositionSize) return [{ data: positionSizeSeries, legend: 'Position Size' }]
    return []
  }, [longEthPNL, longSeries, mode, positionSizeSeries, squeethIsLive])

  const chartOptions = useAppMemo(() => {
    // if (mode === ChartType.Funding || mode === ChartType.PositionSize)
    if (mode === ChartType.PositionSize)
      return {
        ...graphOptions,
        localization: {
          priceFormatter: (num: number) => num + '%',
        },
      }
    if (mode === ChartType.PNL)
      return {
        ...graphOptions,
        localization: {
          priceFormatter: (num: number) => num.toFixed(2) + '%',
        },
      }
    return {
      ...graphOptions,
      priceScale: { mode: 2 },
    }
  }, [mode])

  const startTimestamp = useAppMemo(() => (longSeries && longSeries.length > 0 ? longSeries[0].time : 0), [longSeries])

  const endTimestamp = useAppMemo(
    () => (longSeries && longSeries.length > 0 ? longSeries[longSeries.length - 1].time : 0),
    [longSeries],
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
          <SqueethTab label={`Historical ${days}D PNL Simulation`} />
          {/* <SqueethTab label="Price" /> */}
          {/* <SqueethTab label="Funding" /> */}
          <SqueethTab label="Payoff" />
          {/* <SqueethTab label="Comparison" /> */}
          {/* <SqueethTab label="Details" /> */}
          <SqueethTab label="Premium" />
          <SqueethTab label="Risks" />
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
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <a href={Links.BacktestFAQ} target="_blank" rel="noreferrer">
                      <Tooltip title={Tooltips.BacktestDisclaimer}>
                        <InfoIcon fontSize="small" />
                      </Tooltip>
                    </a>
                  </InputAdornment>
                ),
              }}
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
            goes down (excluding premiums). Eg. If ETH goes up 5x, squeeth goes up 25x. You pay a funding rate for this
            position. Enter the position by purchasing an ERC20 token.{' '}
            <a className={classes.header} href={Links.GitBook} target="_blank" rel="noreferrer">
              {' '}
              Learn more.{' '}
            </a>
          </Typography>
          {/* <Typography className={classes.cardTitle} variant="h6">
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
          </Typography> */}
        </div>
      ) : mode === ChartType.Risks ? (
        <div>
          <Typography className={classes.cardTitle} variant="h6">
            Risks
          </Typography>
          <Typography variant="body2" className={classes.cardDetail}>
            Premiums are paid out of your position, similar to selling a small amount of squeeth as you earn premiums,
            reducing your position size. Holding the position for a long period of time without upward movements in ETH
            can lose considerable funds to premium payments.
            <br /> <br />
            Squeeth smart contracts have been audited by Trail of Bits, Akira, and Sherlock. However, smart contracts
            are experimental technology and we encourage caution only risking funds you can afford to lose.
            <br /> <br />
            Profitability also depends on the price you enter and exit, which is dependent on implied volatility (the
            premium of squeeth to ETH). If the squeeth premium to ETH decreases, without a change in ETH price, a long
            position will incur a loss because it is not worth as much ETH. If ETH goes down considerably, you may lose
            some or all of your initial investment.
            <a className={classes.header} href={Links.GitBook} target="_blank" rel="noreferrer">
              {' '}
              Learn more.{' '}
            </a>
          </Typography>
        </div>
      ) : mode === ChartType.Funding ? (
        <FundingChart />
      ) : (
        // : mode === ChartType.Comparison ? (
        //   <Image src={ComparisonChart} alt="Comparison Chart" height={340} />
        // )
        <div className={classes.payoffContainer} style={{ maxHeight: 'none' }}>
          <div style={{ flex: '1 1 0', marginTop: '8px' }}>
            {lineSeries ? (
              <Chart
                from={startTimestamp}
                to={endTimestamp}
                legend={mode}
                options={chartOptions}
                lineSeries={lineSeries}
                autoWidth
                // width={1000}
                height={300}
                darkTheme
              />
            ) : (
              <Box display="flex" height="300px" width={1} alignItems="center" justifyContent="center">
                <CircularProgress size={40} color="secondary" />
              </Box>
            )}

            <div className={classes.legendBox}>
              {lineSeries && lineSeries[0].data.length > 0 && <LegendBox bgColor="#018FFB" text="ETH PNL" />}
              {lineSeries && lineSeries[1].data.length > 0 && (
                <LegendBox
                  bgColor="#00E396"
                  text="Squeeth Simulated PnL"
                  tooltip="The Squeeth Simulated PnL comes from using at the money implied vol from Deribit"
                />
              )}
              {lineSeries && lineSeries[2].data.length > 0 && <LegendBox bgColor="#FEB01B" text="Squeeth LIVE PNL" />}
            </div>
          </div>

          <div className={classes.intro}>
            <Typography className={classes.cardTitle} variant="h6">
              What is squeeth?
            </Typography>
            <Typography variant="body2" className={classes.cardDetail} style={{ fontSize: '14px' }}>
              Long squeeth (ETH&sup2;) gives you a leveraged position with unlimited upside, protected downside, and no
              liquidations. Compared to a 2x leveraged position, you make more when ETH goes up and lose less when ETH
              goes down (excluding premiums). Eg. If ETH goes up 5x, squeeth goes up 25x. You pay premiums for this
              position. Enter the position by purchasing an ERC20 token.{' '}
              <a className={classes.header} href={Links.GitBook} target="_blank" rel="noreferrer">
                {' '}
                Learn more.{' '}
              </a>
            </Typography>
          </div>
        </div>
      )}
    </>
  )
}

const LongChartMemoized = memo(LongChart)

export { LongChartMemoized as LongChart }

// const convertPNLToPriceChart = (pnlSeries: { time: number; value: number }[], startingCapital: number) => {
//   return pnlSeries.map(({ value, time }) => {
//     return {
//       value: value + startingCapital,
//       time,
//     }
//   })
// }

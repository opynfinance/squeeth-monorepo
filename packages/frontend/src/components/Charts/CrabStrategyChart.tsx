import { createStyles, Hidden, InputAdornment, makeStyles, TextField, Tooltip } from '@material-ui/core'
import Alert from '@material-ui/lab/Alert'
import dynamic from 'next/dynamic'
import React, { memo, useState } from 'react'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import { useAtom } from 'jotai'

import { graphOptions, Links, Tooltips, Vaults } from '../../constants'
import {
  daysAtom,
  useGetStableYieldPNL,
  useGetVaultPNLWithRebalance,
  useLongEthPNL,
  useShortEthPNL,
  useShortSeries,
} from 'src/state/ethPriceCharts/atoms'
import useAppMemo from '@hooks/useAppMemo'

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
      [theme.breakpoints.down('sm')]: {
        width: '100%',
      },
    },
    cardDetail: {
      color: theme.palette.text.secondary,
      lineHeight: '1.75rem',
      fontSize: '14px',
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
      display: 'grid',
      gap: '2rem',
      overflow: 'auto',
      // maxHeight: '310',
      [theme.breakpoints.up('md')]: {
        gridTemplateColumns: '1fr 1fr',
      },
    },
    infoIcon: {
      fontSize: '1rem',
      marginLeft: theme.spacing(0.5),
      marginTop: '2px',
    },
    shortPayoff: {
      width: '90%',
      margin: '0 auto',
      [theme.breakpoints.up('md')]: {
        width: '100%',
        margin: 0,
      },
    },
    legendBox: {
      display: 'flex',
      gap: '10px',
      marginTop: '10px',
      justifyContent: 'center',
    },
    legendContainer: {
      display: 'flex',
      gap: '5px',
    },
    shortDescription: {
      [theme.breakpoints.up('md')]: {
        justifySelf: 'end',
      },
    },
  }),
)

function CrabStrategyChart({ vault, longAmount }: { vault?: Vaults; longAmount: number }) {
  // const startingETHPrice = useStartingETHPrice()
  const getVaultPNLWithRebalance = useGetVaultPNLWithRebalance()
  const longEthPNL = useLongEthPNL()
  const shortEthPNL = useShortEthPNL()
  const getStableYieldPNL = useGetStableYieldPNL()
  const shortSeries = useShortSeries()

  const [days, setDays] = useAtom(daysAtom)

  const seriesRebalance = getVaultPNLWithRebalance(longAmount)
  const classes = useStyles()
  const [chartType] = useState(0)

  const compoundSeries = getStableYieldPNL(1)

  const lineSeries = useAppMemo(() => {
    if (!shortEthPNL || !longEthPNL || !seriesRebalance || !shortSeries) return

    if (vault === Vaults.ETHBull)
      return [
        { data: longEthPNL, legend: 'Long ETH' },
        { data: seriesRebalance, legend: 'ETH Bull Strategy (incl. premium)' },
      ]
    if (vault === Vaults.CrabVault)
      return [
        { data: seriesRebalance, legend: 'Crab Strategy PNL (incl. premium)' },
        { data: getStableYieldPNL(longAmount), legend: 'Compound Interest yield' },
      ]
    if (vault === Vaults.ETHBear)
      return [
        { data: shortEthPNL, legend: 'Short ETH' },
        { data: seriesRebalance, legend: 'ETH Bear Strategy (incl. premium)' },
      ]
    if (vault === Vaults.Short)
      return [
        { data: compoundSeries, legend: 'Compound PNL (%)' },
        { data: shortSeries, legend: 'Crab PnL (%) (incl. premium)' },
        // { data: convertPNLToPriceChart(shortEthPNL, startingETHPrice), legend: 'Short ETH' },
        // { data: convertPNLToPriceChart(shortSeries, startingETHPrice), legend: 'Short Squeeth (incl. funding)' },
      ]
    return [{ data: seriesRebalance, legend: 'PNL' }]
  }, [compoundSeries, getStableYieldPNL, longAmount, longEthPNL, seriesRebalance, shortEthPNL, shortSeries, vault])

  // const lineSeriesPercentage = useAppMemo(() => {
  //   if (!startingETHPrice || !seriesRebalance || !longEthPNL || !shortEthPNL) return

  //   if (vault === Vaults.ETHBull)
  //     return [
  //       { data: convertPNLToPriceChart(longEthPNL, startingETHPrice), legend: 'Long ETH' },
  //       {
  //         data: convertPNLToPriceChart(seriesRebalance, startingETHPrice),
  //         legend: 'ETH Bull Strategy (incl. funding)',
  //       },
  //     ]
  //   if (vault === Vaults.CrabVault)
  //     return [
  //       {
  //         data: convertPNLToPriceChart(getStableYieldPNL(longAmount), startingETHPrice),
  //         legend: 'Compound Interest Yield',
  //       },
  //       {
  //         data: convertPNLToPriceChart(seriesRebalance, startingETHPrice),
  //         legend: 'Crab Strategy PNL (incl. funding)',
  //       },
  //     ]
  //   if (vault === Vaults.ETHBear)
  //     return [
  //       { data: convertPNLToPriceChart(shortEthPNL, startingETHPrice), legend: 'Short ETH' },
  //       {
  //         data: convertPNLToPriceChart(seriesRebalance, startingETHPrice),
  //         legend: 'ETH Bear Strategy (incl. funding)',
  //       },
  //     ]
  //   if (vault === Vaults.Short)
  //     return [
  //       { data: shortEthPNL, legend: 'Short ETH PNL' },
  //       { data: shortSeries, legend: 'Crab (incl. funding)' },
  //       // { data: convertPNLToPriceChart(shortEthPNL, startingETHPrice), legend: 'Short ETH' },
  //       // { data: convertPNLToPriceChart(shortSeries, startingETHPrice), legend: 'Short Squeeth (incl. funding)' },
  //     ]
  //   return [{ data: seriesRebalance, legend: 'PNL' }]
  // }, [vault, shortEthPNL, seriesRebalance, getStableYieldPNL, longAmount, startingETHPrice, shortSeries, longEthPNL])

  const startTimestamp = useAppMemo(
    () => (lineSeries && lineSeries.length > 0 && lineSeries[0].data.length > 0 ? lineSeries[0].data[0].time : 0),
    [lineSeries],
  )

  const endTimestamp = useAppMemo(
    () =>
      lineSeries && lineSeries.length > 0 && lineSeries[0].data.length > 0
        ? lineSeries[0].data[lineSeries[0].data.length - 1].time
        : 0,
    [lineSeries],
  )

  const chartOptions = {
    ...graphOptions,
    localization: {
      priceFormatter: (num: number) => num.toFixed(2) + '%',
    },
  }

  return (
    <div>
      <div className={classes.navDiv}>
        {/* <SqueethTabs
          style={{ background: 'transparent' }}
          className={classes.chartNav}
          value={chartType}
          onChange={(evt, val) => setChartType(val)}
          aria-label="Sub nav tabs"
        >
          <SqueethTab label={`Historical ${days}D PNL`} />
          <SqueethTab label="Payoff" />
          <SqueethTab label="Details" />
          <SqueethTab label="Risks" />
        </SqueethTabs> */}
        <Hidden smDown>
          {chartType === 0 ? (
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
      {seriesRebalance && seriesRebalance.length === 0 && (
        <Alert severity="info"> Loading historical data, this could take a while</Alert>
      )}
      <Chart
        from={startTimestamp}
        to={endTimestamp}
        // legend={`${vault} PNL`}
        options={chartOptions}
        lineSeries={lineSeries}
        autoWidth
        height={300}
        darkTheme
      />

      <div className={classes.legendBox}>
        <div className={classes.legendContainer}>
          <div style={{ width: '20px', height: '20px', backgroundColor: '#018FFB' }}></div>
          <div>Compound cUSDC Yield</div>
        </div>
        <div className={classes.legendContainer}>
          <div style={{ width: '20px', height: '20px', backgroundColor: '#00E396' }}></div>
          <div>Crab PNL</div>
        </div>
      </div>
      {/* <IV /> */}
      {/* {vault === Vaults.Custom && (
        <TextField
          onChange={(event) => setCustomLong(parseFloat(event.target.value))}
          size="small"
          value={longAmount}
          type="number"
          style={{ width: 300 }}
          label="ETH Long"
          variant="outlined"
        />
      )} */}
    </div>
  )
}

export const MemoizedCrabStrategyChart = memo(CrabStrategyChart)

// const convertPNLToPriceChart = (pnlSeries: { time: number; value: number }[], startingCapital: number) => {
//   return pnlSeries.map(({ value, time }) => {
//     return {
//       value: value + startingCapital,
//       time,
//     }
//   })
// }

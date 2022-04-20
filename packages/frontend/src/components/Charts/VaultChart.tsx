import { useETHPrice } from '@hooks/useETHPrice'
import { createStyles, makeStyles, TextField, Typography } from '@material-ui/core'
import Alert from '@material-ui/lab/Alert'
import { useAtomValue } from 'jotai'

import React, { useState } from 'react'
import { collatRatioAtom, useGetVaultPNLWithRebalance } from 'src/state/ethPriceCharts/atoms'

import { Links, Vaults } from '../../constants'
import { SqueethTab, SqueethTabs } from '../Tabs'
import ShortSqueethPayoff from './ShortSqueethPayoff'

// const Chart = dynamic(() => import('kaktana-react-lightweight-charts'), { ssr: false })

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
    shortPayoff: {
      width: '90%',
      margin: '0 auto',
      [theme.breakpoints.up('md')]: {
        width: '100%',
        margin: 0,
      },
    },
    shortDescription: {
      [theme.breakpoints.up('md')]: {
        justifySelf: 'end',
      },
    },
  }),
)

export function VaultChart({
  vault,
  longAmount,
  setCustomLong,
}: {
  vault?: Vaults
  longAmount: number
  setCustomLong: Function
  showPercentage: boolean
}) {
  const ethPrice = useETHPrice()
  const collatRatio = useAtomValue(collatRatioAtom)
  const getVaultPNLWithRebalance = useGetVaultPNLWithRebalance()
  const seriesRebalance = getVaultPNLWithRebalance(longAmount)
  const classes = useStyles()
  const [chartType, setChartType] = useState(0)

  // const startTimestamp = useMemo(() => (seriesRebalance ? seriesRebalance[0].time : 0), [seriesRebalance])
  // const endTimestamp = useMemo(
  //   () => (seriesRebalance.length > 0 ? seriesRebalance[seriesRebalance.length - 1].time : 0),
  //   [seriesRebalance],
  // )

  // const lineSeries = useMemo(() => {
  //   if (vault === Vaults.ETHBull)
  //     return [
  //       { data: longEthPNL, legend: 'Long ETH' },
  //       { data: seriesRebalance, legend: 'ETH Bull Strategy (incl. funding)' },
  //     ]
  //   if (vault === Vaults.CrabVault)
  //     return [
  //       { data: seriesRebalance, legend: 'Crab Strategy PNL (incl. funding)' },
  //       { data: getStableYieldPNL(longAmount), legend: 'Compound Interest yield' },
  //     ]
  //   if (vault === Vaults.ETHBear)
  //     return [
  //       { data: shortEthPNL, legend: 'Short ETH' },
  //       { data: seriesRebalance, legend: 'ETH Bear Strategy (incl. funding)' },
  //     ]
  //   if (vault === Vaults.Short)
  //     return [
  //       // { data: shortEthPNL, legend: 'Short ETH PNL' },
  //       // { data: shortSeries, legend: 'Short Squeeth PNL (incl. funding)' },
  //       { data: convertPNLToPriceChart(shortEthPNL, startingETHPrice), legend: 'Short ETH' },
  //       { data: convertPNLToPriceChart(shortSeries, startingETHPrice), legend: 'Short Squeeth (incl. funding)' },
  //     ]
  //   return [{ data: seriesRebalance, legend: 'PNL' }]
  // }, [vault, longEthPNL, shortEthPNL, seriesRebalance, getStableYieldPNL, longAmount, shortSeries])

  // const lineSeriesPercentage = useMemo(() => {
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
  //       // { data: shortEthPNL, legend: 'Short ETH PNL' },
  //       // { data: shortSeries, legend: 'Short Squeeth PNL (incl. funding)' },
  //       { data: convertPNLToPriceChart(shortEthPNL, startingETHPrice), legend: 'Short ETH' },
  //       { data: convertPNLToPriceChart(shortSeries, startingETHPrice), legend: 'Short Squeeth (incl. funding)' },
  //     ]
  //   return [{ data: seriesRebalance, legend: 'PNL' }]
  // }, [vault, longEthPNL, shortEthPNL, seriesRebalance, getStableYieldPNL, longAmount, startingETHPrice, shortSeries])

  // const chartOptions = useMemo(() => {
  //   if (showPercentage)
  //     return {
  //       ...graphOptions,
  //       priceScale: { mode: 2 },
  //       localization: {
  //         priceFormatter: (num: number) => num + '%',
  //       },
  //     }
  //   else return graphOptions
  // }, [showPercentage])

  return (
    <div>
      <div className={classes.navDiv}>
        <SqueethTabs
          style={{ background: 'transparent' }}
          className={classes.chartNav}
          value={chartType}
          onChange={(evt, val) => setChartType(val)}
          aria-label="Sub nav tabs"
        >
          {/* <SqueethTab label={`Historical ${days}D PNL`} /> */}
          <SqueethTab label="Payoff" />
          {/* <SqueethTab label="Details" /> */}
          <SqueethTab label="Risks" />
        </SqueethTabs>
        {/* <Hidden smDown>
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
        </Hidden> */}
      </div>
      {seriesRebalance && seriesRebalance.length === 0 && (
        <Alert severity="info"> Loading historical data, this could take a while</Alert>
      )}
      {chartType === 0 ? (
        <div className={classes.payoffContainer}>
          <div className={classes.shortPayoff}>
            <ShortSqueethPayoff ethPrice={ethPrice.toNumber()} collatRatio={collatRatio} />
          </div>

          <div className={classes.shortDescription}>
            <Typography className={classes.cardTitle} variant="h6">
              What is short squeeth?
            </Typography>
            <Typography variant="body2" className={classes.cardDetail}>
              Short squeeth (ETH&sup2;) is an ETH collateralized short ETH&sup2; position. Your returns will be a
              combination of being short oSQTH and long ETH collateral. You earn a funding rate for taking on this
              position. You enter the position by putting down collateral, minting, and selling squeeth. You provide ETH
              collateral to mint squeeth, and your collateralization ratio determines your exposure. If you become
              undercollateralized, you could be liquidated.{' '}
              <a className={classes.header} href={Links.GitBook} target="_blank" rel="noreferrer">
                {' '}
                Learn more.{' '}
              </a>
            </Typography>
          </div>
        </div>
      ) : (
        // <Chart
        //   from={Math.floor(startTimestamp)}
        //   to={endTimestamp}
        //   // legend={`${vault} PNL`}
        //   options={chartOptions}
        //   lineSeries={showPercentage ? lineSeriesPercentage : lineSeries}
        //   autoWidth
        //   height={290}
        //   darkTheme
        // />
        // )
        // : chartType === 1 ? (
        //   <div className={classes.payoffContainer}>
        //     <ShortSqueethPayoff ethPrice={ethPrice.toNumber()} collatRatio={collatRatio} />
        //   </div>
        // chartType === 1 ? (
        //   <div style={{ overflow: 'auto', maxHeight: '300px' }}>
        //     <Typography className={classes.cardTitle} variant="h6">
        //       What is short squeeth?
        //     </Typography>
        //     <Typography variant="body2" className={classes.cardDetail}>
        //       Short squeeth (ETH&sup2;) is short an ETH&sup2; position. You earn a funding rate for taking on this
        //       position. You enter the position by putting down collateral, minting, and selling squeeth. You provide ETH
        //       collateral to mint squeeth, and your collateralization ratio determines your exposure. If you become
        //       undercollateralized, you could be liquidated.{' '}
        //       <a
        //         className={classes.header}
        //         href="https://opyn.gitbook.io/squeeth/resources/squeeth-faq"
        //         target="_blank"
        //         rel="noreferrer"
        //       >
        //         {' '}
        //         Learn more.{' '}
        //       </a>
        //     </Typography>
        //   </div>
        // ) :
        <div>
          {' '}
          <Typography className={classes.cardTitle} variant="h6">
            Risks
          </Typography>
          <Typography variant="body2" className={classes.cardDetail}>
            If you fall below the minimum collateralization threshold (150%), you are at risk of liquidation. This
            position performs best when ETH price does not move much. If ETH price moves considerably, it is likely
            unprofitable.
            <br /> <br />
            Squeeth smart contracts have been audited by Trail of Bits, Akira, and Sherlock. However, smart contracts
            are experimental technology and we encourage caution only risking funds you can afford to lose.
            <a className={classes.header} href={Links.GitBook} target="_blank" rel="noreferrer">
              {' '}
              Learn more.{' '}
            </a>
          </Typography>
        </div>
      )}
      <br />
      {/* <IV /> */}
      {vault === Vaults.Custom && (
        <TextField
          onChange={(event) => setCustomLong(parseFloat(event.target.value))}
          size="small"
          value={longAmount}
          type="number"
          style={{ width: 300 }}
          label="ETH Long"
          variant="outlined"
        />
      )}
    </div>
  )
}

// const convertPNLToPriceChart = (pnlSeries: { time: number; value: number }[], startingCapital: number) => {
//   return pnlSeries.map(({ value, time }) => {
//     return {
//       value: value + startingCapital,
//       time,
//     }
//   })
// }

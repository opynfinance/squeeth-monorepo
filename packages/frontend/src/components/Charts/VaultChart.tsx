import { TextField } from '@material-ui/core'
import Alert from '@material-ui/lab/Alert'
import dynamic from 'next/dynamic'
import React, { useMemo } from 'react'

import { graphOptions, Vaults } from '../../constants'
import { useWorldContext } from '../../context/world'
import IV from '../IV'

const Chart = dynamic(() => import('kaktana-react-lightweight-charts'), { ssr: false })

export function VaultChart({
  vault,
  longAmount,
  setCustomLong,
  showPercentage,
}: {
  vault?: Vaults
  longAmount: number
  setCustomLong: Function
  showPercentage: boolean
}) {
  const {
    startingETHPrice,
    getVaultPNLWithRebalance,
    days,
    setDays,
    longEthPNL,
    shortEthPNL,
    getStableYieldPNL,
    shortSeries,
  } = useWorldContext()

  const seriesRebalance = getVaultPNLWithRebalance(longAmount)

  const startTimestamp = useMemo(() => (seriesRebalance.length > 0 ? seriesRebalance[0].time : 0), [seriesRebalance])
  const endTimestamp = useMemo(
    () => (seriesRebalance.length > 0 ? seriesRebalance[seriesRebalance.length - 1].time : 0),
    [seriesRebalance],
  )

  const lineSeries = useMemo(() => {
    if (vault === Vaults.ETHBull)
      return [
        { data: longEthPNL, legend: 'Long ETH' },
        { data: seriesRebalance, legend: 'ETH Bull Strategy (incl. funding)' },
      ]
    if (vault === Vaults.CrabVault)
      return [
        { data: seriesRebalance, legend: 'Crab Strategy PNL (incl. funding)' },
        { data: getStableYieldPNL(longAmount), legend: 'Compound Interest yield' },
      ]
    if (vault === Vaults.ETHBear)
      return [
        { data: shortEthPNL, legend: 'Short ETH' },
        { data: seriesRebalance, legend: 'ETH Bear Strategy (incl. funding)' },
      ]
    if (vault === Vaults.Short)
      return [
        { data: shortEthPNL, legend: 'Short ETH PNL' },
        { data: shortSeries, legend: 'Short Squeeth PNL (incl. funding)' },
      ]
    return [{ data: seriesRebalance, legend: 'PNL' }]
  }, [vault, longEthPNL, shortEthPNL, seriesRebalance, getStableYieldPNL, longAmount, shortSeries])

  const lineSeriesPercentage = useMemo(() => {
    if (vault === Vaults.ETHBull)
      return [
        { data: convertPNLToPriceChart(longEthPNL, startingETHPrice), legend: 'Long ETH' },
        {
          data: convertPNLToPriceChart(seriesRebalance, startingETHPrice),
          legend: 'ETH Bull Strategy (incl. funding)',
        },
      ]
    if (vault === Vaults.CrabVault)
      return [
        {
          data: convertPNLToPriceChart(getStableYieldPNL(longAmount), startingETHPrice),
          legend: 'Compound Interest Yield',
        },
        {
          data: convertPNLToPriceChart(seriesRebalance, startingETHPrice),
          legend: 'Crab Strategy PNL (incl. funding)',
        },
      ]
    if (vault === Vaults.ETHBear)
      return [
        { data: convertPNLToPriceChart(shortEthPNL, startingETHPrice), legend: 'Short ETH' },
        {
          data: convertPNLToPriceChart(seriesRebalance, startingETHPrice),
          legend: 'ETH Bear Strategy (incl. funding)',
        },
      ]
    if (vault === Vaults.Short)
      return [
        { data: convertPNLToPriceChart(shortEthPNL, startingETHPrice), legend: 'Short ETH' },
        { data: convertPNLToPriceChart(shortSeries, startingETHPrice), legend: 'Short Squeeth (incl. funding)' },
      ]
    return [{ data: seriesRebalance, legend: 'PNL' }]
  }, [vault, longEthPNL, shortEthPNL, seriesRebalance, getStableYieldPNL, longAmount, startingETHPrice, shortSeries])

  const chartOptions = useMemo(() => {
    if (showPercentage)
      return {
        ...graphOptions,
        priceScale: { mode: 2 },
        localization: {
          priceFormatter: (num: number) => num + '%',
        },
      }
    else return graphOptions
  }, [showPercentage])

  return (
    <div>
      {seriesRebalance.length === 0 && <Alert severity="info"> Loading historical data, this could take a while</Alert>}
      <Chart
        from={Math.floor(startTimestamp)}
        to={endTimestamp}
        // legend={`${vault} PNL`}
        options={chartOptions}
        lineSeries={showPercentage ? lineSeriesPercentage : lineSeries}
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

const convertPNLToPriceChart = (pnlSeries: { time: number; value: number }[], startingCapital: number) => {
  return pnlSeries.map(({ value, time }) => {
    return {
      value: value + startingCapital,
      time,
    }
  })
}

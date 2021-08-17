import React, { useMemo } from 'react'
import { TextField } from '@material-ui/core'
import dynamic from 'next/dynamic'
import Alert from '@material-ui/lab/Alert';
import { useWorldContext } from '../../context/world'
import { graphOptions, Vaults } from '../../constants'
import IV from '../IV';

const Chart = dynamic(
  () => import('kaktana-react-lightweight-charts'),
  { ssr: false }
)

export function VaultChart({ vault, longAmount, setCustomLong, showPercentage }: { vault: Vaults, longAmount: number, setCustomLong: Function, showPercentage: boolean }) {

  const { startingETHPrice, getVaultPNLWithRebalance, days, setDays, longEthPNL, shortEthPNL, getStableYieldPNL } = useWorldContext()

  const seriesRebalance = getVaultPNLWithRebalance(longAmount)

  const startTimestamp = useMemo(() => seriesRebalance.length > 0 ? seriesRebalance[0].time : 0, [seriesRebalance])
  const endTimestamp = useMemo(() => seriesRebalance.length > 0 ? seriesRebalance[seriesRebalance.length - 1].time : 0, [seriesRebalance])

  const lineSeries = useMemo(() => {
    if (vault === Vaults.ETHBull) return [
      { data: longEthPNL, legend: 'Long ETH' },
      { data: seriesRebalance, legend: 'ETH Bull Vault' }
    ]
    if (vault === Vaults.CrabVault) return [
      { data: seriesRebalance, legend: 'Crab Vault PNL' },
      { data: getStableYieldPNL(longAmount), legend: 'Compound Interest yield' },
    ]
    if (vault === Vaults.ETHBear) return [
      { data: shortEthPNL, legend: 'Short ETH' },
      { data: seriesRebalance, legend: 'ETH Bear Vault' }
    ]
    return [{ data: seriesRebalance, legend: 'PNL' }]
  }, [vault, longEthPNL, shortEthPNL, seriesRebalance, getStableYieldPNL, longAmount])

  const lineSeriesPercentage = useMemo(() => {
    if (vault === Vaults.ETHBull) return [
      { data: convertPNLToPriceChart(longEthPNL, startingETHPrice), legend: 'Long ETH' },
      { data: convertPNLToPriceChart(seriesRebalance, startingETHPrice), legend: 'ETH Bull Vault' }
    ]
    if (vault === Vaults.CrabVault) return [
      { data: convertPNLToPriceChart(getStableYieldPNL(longAmount), startingETHPrice), legend: 'Compound Interest Yield' },
      { data: convertPNLToPriceChart(seriesRebalance, startingETHPrice), legend: 'Crab Vault PNL' },
    ]
    if (vault === Vaults.ETHBear) return [
      { data: convertPNLToPriceChart(shortEthPNL, startingETHPrice), legend: 'Short ETH' },
      { data: convertPNLToPriceChart(seriesRebalance, startingETHPrice), legend: 'ETH Bear Vault' }
    ]
    return [{ data: seriesRebalance, legend: 'PNL' }]
  }, [vault, longEthPNL, shortEthPNL, seriesRebalance, getStableYieldPNL, longAmount, startingETHPrice])

  const chartOptions = useMemo(() => {
    if (showPercentage) return {
      ...graphOptions,
      priceScale: { mode: 2 },
      localization: {
        priceFormatter: (num: number) => num + '%'
      }
    }
    else return graphOptions
  }, [showPercentage])

  return (
    <div>
      { seriesRebalance.length === 0 && <Alert severity="info"> Loading historical data, this could take a while</Alert> }
      <Chart
        from={Math.floor(startTimestamp)}
        to={endTimestamp}
        // legend={`${vault} PNL`}
        options={chartOptions}
        lineSeries={showPercentage ? lineSeriesPercentage : lineSeries}
        autoWidth
        height={300}
      />
      <br />
      <div style={{ marginBottom: '16px'}}>
        <TextField
          onChange={(event) => setDays(parseInt(event.target.value))}
          size="small"
          value={days}
          type="number"
          style={{ width: 300 }}
          label="Back Test Days"
          variant="outlined" />
      </div>
      <IV />
      {vault === Vaults.Custom &&
        <TextField
          onChange={(event) => setCustomLong(parseFloat(event.target.value))}
          size="small"
          value={longAmount}
          type="number"
          style={{ width: 300 }}
          label="ETH Long"
          variant="outlined" />
      }
    </div>
  )
}

const convertPNLToPriceChart = (pnlSeries: { time: number, value: number }[], startingCapital: number) => {
  return pnlSeries.map(({ value, time }) => {
    return {
      value: value + startingCapital,
      time,
    }
  })

}
import useSqueethShortPayOffGraph from '@hooks/payOffGraph/useSqueethShortPayOffGraph'
import React, { memo, useCallback } from 'react'
import { Line } from 'react-chartjs-2'

import { Vaults } from '../../constants'

const color0 = '#6df7e7'
const color1 = '#6df7e7'
const color14 = '#6d78f7'
const color28 = '#F5B073'

const chartOptions = {
  maintainAspectRatio: false,
  responsive: false,
  title: { display: true },
  legend: {
    display: true,
  },
  scales: {
    yAxes: [
      {
        display: true,
        gridLines: {
          zeroLineWidth: 2,
          lineWidth: 0,
          zeroLineColor: '#77757E80',
        },
        ticks: {
          display: true,
        },
        scaleLabel: {
          labelString: '% Return',
          display: true,
        },
      },
    ],
    xAxes: [
      {
        display: true,
        scaleLabel: {
          labelString: 'ETH price',
          display: true,
        },
        ticks: {
          display: true,
          autoSkip: true,
          maxTicksLimit: 10,
        },
        gridLines: {
          lineWidth: 0,
          zeroLineWidth: 0,
        },
      },
    ],
  },
  tooltips: {
    enabled: true,
    intersect: false,
    mode: 'index',
    callbacks: {
      label: function (tooltipItem: any, data: any) {
        return `${data.datasets[tooltipItem.datasetIndex].label}: ${tooltipItem.yLabel} %`
      },
      title: function (tooltipItem: any) {
        return `ETH Price: $${tooltipItem[0].xLabel}`
      },
    },
  },
  animation: { duration: 0 },
  hover: { animationDuration: 0, intersect: false },
  onHover: (_: any, elements: any) => {
    if (elements && elements.length) {
      const chartElem = elements[0]
      const chart = chartElem._chart
      const ctx = chart.ctx

      ctx.globalCompositeOperation = 'destination-over'
      const x = chartElem._view.x
      const topY = chart.scales['y-axis-0'].top
      const bottomY = chart.scales['y-axis-0'].bottom

      ctx.save()
      ctx.beginPath()
      ctx.setLineDash([5, 5])
      ctx.moveTo(x, topY)
      ctx.lineTo(x, bottomY)
      ctx.lineWidth = 1
      ctx.strokeStyle = '#77757E80'
      ctx.stroke()
      ctx.restore()

      ctx.globalCompositeOperation = 'source-over'
    }
  },
}

const ShortSqueethPayoff: React.FC<{ ethPrice: number; collatRatio: number; vaultType?: Vaults }> = ({
  ethPrice,
  collatRatio,
  vaultType,
}) => {
  const {
    ethPrices: labels,
    payout0: values0,
    payout1: values1,
    payout14: values14,
    payout28: values28,
  } = useSqueethShortPayOffGraph(ethPrice, collatRatio)

  const getData = useCallback(() => {
    return {
      labels,
      datasets: [
        {
          label: '28 day return',
          data: values28,
          fill: false,
          borderColor: color28,
          pointHoverBorderColor: color28,
          pointHoverBackgroundColor: color28,
          pointBackgroundColor: 'rgba(0, 0, 0, 0)',
          pointBorderColor: 'rgba(0, 0, 0, 0)',
          pointHoverRadius: 5,
          pointHitRadius: 30,
        },
        {
          label: '14 day return',
          data: values14,
          fill: false,
          borderColor: color14,
          pointHoverBorderColor: color14,
          pointHoverBackgroundColor: color14,
          pointBackgroundColor: 'rgba(0, 0, 0, 0)',
          pointBorderColor: 'rgba(0, 0, 0, 0)',
          pointHoverRadius: 5,
          pointHitRadius: 30,
        },
        {
          label: '0 day return',
          data: values0,
          fill: false,
          borderColor: color0,
          pointHoverBorderColor: color0,
          pointHoverBackgroundColor: color0,
          pointBackgroundColor: 'rgba(0, 0, 0, 0)',
          pointBorderColor: 'rgba(0, 0, 0, 0)',
          pointHoverRadius: 5,
          pointHitRadius: 30,
        },
      ],
    }
  }, [labels, values0, values14, values28])

  const getCrabData = useCallback(() => {
    return {
      labels,
      datasets: [
        {
          label: '1 day return',
          data: values1,
          fill: false,
          borderColor: color1,
          pointHoverBorderColor: color1,
          pointHoverBackgroundColor: color1,
          pointBackgroundColor: 'rgba(0, 0, 0, 0)',
          pointBorderColor: 'rgba(0, 0, 0, 0)',
          pointHoverRadius: 5,
          pointHitRadius: 30,
        },
      ],
    }
  }, [labels, values1])

  return (
    <div style={{ width: '100%' }}>
      {vaultType === Vaults.CrabVault ? (
        <Line data={getCrabData} type="line" height={300} width={400} options={chartOptions} />
      ) : (
        <Line data={getData} type="line" height={300} width={400} options={chartOptions} />
      )}
    </div>
  )
}

export default memo(ShortSqueethPayoff)

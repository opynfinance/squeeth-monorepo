import { createStyles, makeStyles } from '@material-ui/core'
import React, { useCallback, useEffect, useState } from 'react'
import { Line } from 'react-chartjs-2'

import { Vaults } from '../../constants'
import { getCrabVaultPayoff, getSqueethShortPayOffGraph } from '../../utils'

const color0 = '#6df7e7'
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
      title: function (tooltipItem: any, data: any) {
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

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      height: '300px',
      marginTop: '10px',
      width: '430px',
    },
  }),
)

const ShortSqueethPayoff: React.FC<{ ethPrice: number; collatRatio: number; vaultType?: Vaults }> = ({
  ethPrice,
  collatRatio,
  vaultType,
}) => {
  const [labels, setLabels] = useState<Array<number>>([])
  const [values0, setValues0] = useState<Array<string>>([])
  const [values14, setValues14] = useState<Array<string | null>>([])
  const [values28, setValues28] = useState<Array<string | null>>([])

  const classes = useStyles()

  useEffect(() => {
    if (!vaultType) {
      const { ethPrices, payout0, payout14, payout28 } = getSqueethShortPayOffGraph(ethPrice, collatRatio)
      setLabels(ethPrices)
      setValues0(payout0)
      setValues14(payout14)
      setValues28(payout28)
    } else if (vaultType === Vaults.CrabVault) {
      const { ethPrices, payout0, payout14, payout28 } = getCrabVaultPayoff(ethPrice, collatRatio)
      setLabels(ethPrices)
      setValues0(payout0)
      setValues14(payout14)
      setValues28(payout28)
    }
  }, [ethPrice, collatRatio])

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

  return (
    <div style={{ width: '350px', marginLeft: '-30px' }}>
      <Line data={getData} type="line" height={375} width={380} options={chartOptions} />
    </div>
  )
}

export default ShortSqueethPayoff

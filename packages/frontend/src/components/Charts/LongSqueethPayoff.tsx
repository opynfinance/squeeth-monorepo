import useAppCallback from '@hooks/useAppCallback'
import useAppEffect from '@hooks/useAppEffect'
import React, { memo, useState } from 'react'
import { Line } from 'react-chartjs-2'

import { getSqueethLongPayOffGraph } from '../../utils'

const primaryColor = '#2CE6F9'
const errorColor = '#EC7987'

const chartOptions = {
  maintainAspectRatio: false,
  responsive: false,
  title: { display: true },
  legend: {
    display: true,
    labels: {
      filter: (legendItem: any) => {
        const label = legendItem.text
        if (label === '2xLeverage') return false
        return true
      },
    },
  },
  scales: {
    yAxes: [
      {
        display: true,
        gridLines: {
          zeroLineWidth: 0,
          lineWidth: 0,
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
          labelString: '% Change in ETH price',
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
        return `${tooltipItem[0].xLabel} % ETH Change`
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

const LongSqueethPayoff: React.FC<{ ethPrice: number }> = ({ ethPrice }) => {
  const [labels, setLabels] = useState<Array<string>>([])
  const [values, setValues] = useState<Array<string>>([])
  const [twoXValues, setTwoXvalues] = useState<Array<number | null>>([])
  const [twoXImgValues, setTwoXImgvalues] = useState<Array<number | null>>([])

  useAppEffect(() => {
    const { ethPercents, powerTokenPayout, twoXLeverage, twoXLeverageImaginary } = getSqueethLongPayOffGraph(ethPrice)
    setLabels(ethPercents)
    setValues(powerTokenPayout)
    setTwoXvalues(twoXLeverage)
    setTwoXImgvalues(twoXLeverageImaginary)
  }, [ethPrice])

  const getData = useAppCallback(() => {
    return {
      labels,
      datasets: [
        {
          label: 'Squeeth',
          data: values,
          fill: false,
          borderColor: primaryColor,
          pointHoverBorderColor: primaryColor,
          pointHoverBackgroundColor: primaryColor,
          pointBackgroundColor: 'rgba(0, 0, 0, 0)',
          pointBorderColor: 'rgba(0, 0, 0, 0)',
          pointHoverRadius: 5,
          pointHitRadius: 30,
        },
        {
          label: '2x Leverage',
          data: twoXValues,
          fill: false,
          borderColor: errorColor,
          pointHoverBorderColor: errorColor,
          pointHoverBackgroundColor: errorColor,
          pointBackgroundColor: 'rgba(0, 0, 0, 0)',
          pointBorderColor: 'rgba(0, 0, 0, 0)',
          pointHoverRadius: 5,
          pointHitRadius: 30,
        },
        {
          label: '2xLeverage',
          data: twoXImgValues,
          fill: false,
          borderDash: [5, 5],
          borderColor: errorColor,
          pointHoverBorderColor: errorColor,
          pointHoverBackgroundColor: errorColor,
          pointBackgroundColor: 'rgba(0, 0, 0, 0)',
          pointBorderColor: 'rgba(0, 0, 0, 0)',
          pointHoverRadius: 5,
          pointHitRadius: 30,
        },
      ],
    }
  }, [labels, values, twoXValues, twoXImgValues])

  return (
    <div style={{ width: '350px' }}>
      <Line data={getData} type="line" height={300} width={380} options={chartOptions} />
    </div>
  )
}

export default memo(LongSqueethPayoff)

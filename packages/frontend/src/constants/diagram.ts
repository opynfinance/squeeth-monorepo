export const graphOptions = {
  alignLabels: true,
  priceScale: {
    scaleMargins: {
      top: 0.2,
      bottom: 0.15,
    },
    mode: 0,
  },
  timeScale: {
    rightOffset: 5,
    barSpacing: 3,
    fixLeftEdge: false, // false: can move before starting point
    lockVisibleTimeRangeOnResize: true,
    rightBarStaysOnScroll: true,
    borderVisible: false,
    borderColor: '#fff000',
    visible: true,
    timeVisible: true,
    secondsVisible: false,
  },
  localization: {
    priceFormatter: function (price: any) {
      return '$' + Number(price.toFixed(2)).toLocaleString()
    },
    locale: 'en-US',
  },
  grid: {
    vertLines: {
      color: 'rgba(255, 255, 255, 0.12)',
      visible: false,
    },
    horzLines: {
      color: 'rgba(255, 255, 255, 0.12)',
      visible: false,
    },
  },
  layout: {
    fontSize: 12,
    backgroundColor: '#181B1C00',
    fontFamily: 'Open Sans',
  },
}


export const crabV2graphOptions = {
  chart: {
    backgroundColor: 'none',
    zoomType: 'xy',
  },
  title: {
    text: ''
  },
  legend: {
    enabled: true,
    itemMarginTop: 10,
    backgroundColor: '#343738',
    borderRadius: 10,
    itemStyle: {
      "color": "#BABBBB"
    }
  },
  xAxis: {
    type: 'datetime',
    tickWidth: 0,
    lineWidth: 0,
    showFirstLabel: true,
    showLastLabel: true,
    startOnTick: true,
    crosshair: {
        color: '#999'
    },
    labels: {
      style: {
        color: '#BABBBB'
      }
    }
  },
  tooltip: {
    shared: true,
  },
  credits: {
    enabled: false
  },
  exporting: {
    enabled: true
  },
}

import { Box, CircularProgress, Typography} from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React, { memo, useEffect } from 'react'
import useAppMemo from '@hooks/useAppMemo'
import { useCrabPnLV2ChartData } from 'src/state/ethPriceCharts/atoms'
import { crabV2graphOptions } from '@constants/diagram'
import HighchartsReact from 'highcharts-react-official'
import Highcharts from 'highcharts'


export type ChartDataInfo = {
    timestamp: number
    crabPnL: number
    crabEthPnl: number
    ethUsdPnl: number
  }

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
      padding: theme.spacing(0),
      marginTop: theme.spacing(4),
      marginBottom: theme.spacing(1),
      maxWidth: '640px',
    },
    chartContainer: {
      borderRadius: theme.spacing(1),
      padding: theme.spacing(1, 2),
      display: 'flex',
      marginTop: theme.spacing(2),
      [theme.breakpoints.up('sm')]: {
        maxHeight: '310px',
      },
      [theme.breakpoints.down('sm')]: {
        flexDirection: 'column',
      },
       
    },
  }),
)

function StrategyPnLV2() {
    
    const classes = useStyles()
    const query = useCrabPnLV2ChartData()
    let crabUsdPnlSeries : any[]
    let crabEthPnlSeries : any[]
    let ethUsdPnlSeries : any[]
   
    crabUsdPnlSeries = query?.data?.data.map((x: ChartDataInfo) => ([ x.timestamp*1000, x.crabPnL*100 ])) ;
    crabEthPnlSeries = query?.data?.data.map((x: ChartDataInfo) => ([ x.timestamp*1000, x.crabEthPnl ])) ;
    ethUsdPnlSeries = query?.data?.data.map((x: ChartDataInfo) => ([ x.timestamp*1000, x.ethUsdPnl ])) ;


    const lastMarkerPoints = useAppMemo(() => {
      const crabUsdMarker = (crabUsdPnlSeries) ? crabUsdPnlSeries[crabUsdPnlSeries?.length -1]: [];
      const crabEthMarker = (crabEthPnlSeries) ? crabEthPnlSeries[crabEthPnlSeries?.length -1]: [];
      const ethUsdMarker = (ethUsdPnlSeries) ? ethUsdPnlSeries[ethUsdPnlSeries?.length -1]: [];

      let lastCrabUsdItem = (crabUsdPnlSeries) ? crabUsdPnlSeries.pop() : [];
      let newCrabUsdLastItem = {
        x: lastCrabUsdItem[0],
        y: lastCrabUsdItem[1],
        dataLabels: {
            align: 'center',
            enabled: true,
            useHTML: true,
            formatter: function() {
                return '<div style="color:#BABBBB"> Crab/USD 🦀</div>';
            }
        }
     }
     if(crabUsdPnlSeries)
     crabUsdPnlSeries.push(newCrabUsdLastItem)

     let lastCrabEthItem = (crabEthPnlSeries) ? crabEthPnlSeries.pop() : [];
      let newCrabEthLastItem = {
        x: lastCrabEthItem[0],
        y: lastCrabEthItem[1],
        dataLabels: {
            align: 'center',
            enabled: true,
            useHTML: true,
            formatter: function() {
                return '<div style="color:#BABBBB"> Crab/ETH </div>';
            }
        }
     }
     if(crabEthPnlSeries)
     crabEthPnlSeries.push(newCrabEthLastItem)

     let lastEthUsdItem = (ethUsdPnlSeries) ? ethUsdPnlSeries.pop() : [];
     let newEthUsdLastItem = {
       x: lastEthUsdItem[0],
       y: lastEthUsdItem[1],
       dataLabels: {
           align: 'center',
           enabled: true,
           useHTML: true,
           formatter: function() {
               return '<div style="color:#BABBBB"> ETH/USD </div>';
           }
       }
    }
    if(ethUsdPnlSeries)
    ethUsdPnlSeries.push(newEthUsdLastItem)

      return [crabUsdMarker[1],crabEthMarker[1],ethUsdMarker[1]]
    }, [crabUsdPnlSeries,crabEthPnlSeries,ethUsdPnlSeries])

    useEffect(() => {
      Highcharts.setOptions({
       lang: {
        thousandsSep: ','
       }
      });
     }, []);

    const series = [{
      name: 'Crab/USD % Return',
      yAxis: 0,
      data: crabUsdPnlSeries,
      tooltip: {
        valueDecimals: 2,
        valueSuffix: '%',
      },
      color: "#2ce6f9",
    }
    ,{
      yAxis: 0,
      name: 'Crab/ETH % Return',
      data: crabEthPnlSeries,
      tooltip: {
        valueDecimals: 2,
        valueSuffix: '%'
      },
      color: "#5B7184"
    }
    ,{
      yAxis: 0,
      name: 'ETH/USD % return',
      data: ethUsdPnlSeries,
      tooltip: {
        valueDecimals: 2,
        valueSuffix: '%'
      },
      color: '#484B3D'
    }
    ]

    const axes = { 
    
      yAxis: [{ // Left yAxis
      title: {
          text: ''
      },
      labels: {
        style: {
          color: '#BABBBB'
        },
      
      },
      gridLineColor: 'rgba(221,221,221,0.1)',
  
   },{
      title: {
        text: ''
      },
      opposite:true,
      linkedTo:0,
      tickPositions:lastMarkerPoints,
      gridLineWidth:0,
      labels: {
        style: {
          color: '#e6e6e6'
        },
      format: '{value:.2f}' + '%'
      }
    }

      ],

  
  }

    const chartOptions = useAppMemo(() => {
      return {
          ...crabV2graphOptions,
          series: series,
          ...axes
      }
    })

    return (
        <div className={classes.container}>
          <div style={{ display: 'flex', marginTop: '32px' }}>
              <Typography variant="h5" color="primary" style={{}}>
              Strategy Performance 
              </Typography>
          </div>
          <div className={classes.chartContainer} style={{ maxHeight: 'none' }}>
              <div style={{ flex: '1 1 0', marginTop: '8px' }}>
                  {crabUsdPnlSeries ? (
                  <HighchartsReact highcharts={Highcharts} options={chartOptions}  />
                  ) : (
                  <Box display="flex" height="300px" width={1} alignItems="center" justifyContent="center">
                      <CircularProgress size={40} color="secondary" />
                  </Box>
                  )}
            </div> 
          </div>  
        </div>
    )
}

const ChartMemoized = memo(StrategyPnLV2)

export { ChartMemoized as StrategyPnLV2 }


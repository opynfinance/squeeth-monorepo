import { Box, CircularProgress, IconButton, Typography,  Hidden, TextField, Tooltip,  InputAdornment, } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React, { memo, useEffect, useState } from 'react'
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
   
    const crabUsdPnlSeries = query?.data?.data.map((x: ChartDataInfo) => ([ x.timestamp*1000, x.crabPnL*100 ])) ;
    const crabEthPnlSeries = query?.data?.data.map((x: ChartDataInfo) => ([ x.timestamp*1000, x.crabEthPnl ])) ;
    const ethUsdPnlSeries = query?.data?.data.map((x: ChartDataInfo) => ([ x.timestamp*1000, x.ethUsdPnl ])) ;

    useEffect(() => {
      Highcharts.setOptions({
       lang: {
        thousandsSep: ','
       }
      });
     }, []);

    const series = [{
      name: 'Crab/USD % Return',
      yAxis: 1,
      data: crabUsdPnlSeries,
      tooltip: {
        valueDecimals: 2,
        valueSuffix: '%',
      },
      color: "#00e396"
    }
    ,{
      yAxis: 1,
      name: 'Crab/ETH % Return',
      data: crabEthPnlSeries,
      tooltip: {
        valueDecimals: 6,
        valueSuffix: '%'
      },
      color: "#0d2839"
    }
    ,{
      yAxis: 1,
      name: 'ETH/USD % return',
      data: ethUsdPnlSeries,
      tooltip: {
        valueDecimals: 2,
        valueSuffix: '%'
      },
      color: '#484B3D'
    }
    ]

    const chartOptions = useAppMemo(() => {
      return {
          ...crabV2graphOptions,
          series: series
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



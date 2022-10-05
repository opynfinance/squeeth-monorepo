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
    crabEth: number
    crabUsd: number
    ethUsd: number
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
 
    const pnlSeries = query?.data?.data.map((x: ChartDataInfo) => ([ x.timestamp*1000, x.crabPnL*100 ])) ;
    const crabEthSeries = query?.data?.data.map((x: ChartDataInfo) => ([ x.timestamp*1000, x.crabEth ])) ;
    const crabUsdSeries = query?.data?.data.map((x: ChartDataInfo) => ([ x.timestamp*1000, x.crabUsd ])) ;
    const ethUsdSeries = query?.data?.data.map((x: ChartDataInfo) => ([ x.timestamp*1000, x.ethUsd ])) ;

    useEffect(() => {
      Highcharts.setOptions({
       lang: {
        thousandsSep: ','
       }
      });
     }, []);

    const series = [{
      name: 'PnL',
      yAxis: 1,
      data: pnlSeries,
      tooltip: {
        valueDecimals: 2,
        valueSuffix: '%',
      },
    }
    ,{
      yAxis: 1,
      name: 'Crab/Eth',
      data: crabEthSeries,
      tooltip: {
        valueDecimals: 6,
        valueSuffix: ' ETH'
      },
      color: "#F5B7B1"
    },
    {
      yAxis: 0,
      name: 'Crab/Usd',
      data: crabUsdSeries,
      tooltip: {
        valueDecimals: 2,
        valuePrefix: '$'
      },
      color: "#21618C"
    }
    ,{
      yAxis: 0,
      name: 'Eth/Usd',
      data: ethUsdSeries,
      tooltip: {
        valueDecimals: 2,
        valuePrefix: '$'
      },
      color: '#E59866'
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
                  {pnlSeries ? (
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



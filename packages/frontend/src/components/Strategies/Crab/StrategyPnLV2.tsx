import { Box, CircularProgress, IconButton, Typography,  Hidden, TextField, Tooltip,  InputAdornment, } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React, { memo, useState } from 'react'
import dynamic from 'next/dynamic'
import useAppMemo from '@hooks/useAppMemo'
import { useCrabPnLV2ChartData } from 'src/state/ethPriceCharts/atoms'

import { atom, useAtom, useAtomValue } from 'jotai'
import { crabV2graphOptions } from '@constants/diagram'
import HighchartsReact from "highcharts-react-official"
import Highcharts from "highcharts/highstock"


export type ChartDataInfo = {
    timestamp: number
    crabPnL: number
    crabEth: number
    crabUsd: number
    ethUsd: number
  }


enum ChartType {
    PNL = 'PNL',
}
const chartTradeTypeAtom = atom(0)

const useStyles = makeStyles((theme) =>
  createStyles({
    container: {
 
      padding: theme.spacing(0),
      marginTop: theme.spacing(4),
      marginBottom: theme.spacing(1),
      maxWidth: '640px',
    },
    green: {
      color: theme.palette.success.main,
    },
    red: {
      color: theme.palette.error.main,
    },
    navDiv: {
        display: 'flex',
        marginBottom: theme.spacing(2),
        alignItems: 'center',
        marginTop: theme.spacing(2),
      },
    legendBox: {
        display: 'flex',
        gap: '10px',
        marginTop: '10px',
        justifyContent: 'center',
      },
      payoffContainer: {
        //  background: theme.palette.background.stone,
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

const modeAtom = atom<ChartType>((get) => {
    const tradeType = get(chartTradeTypeAtom)
    if (tradeType === 0) return ChartType.PNL
    return ChartType.PNL
})

function StrategyPnLV2() {
    
    const classes = useStyles()
    const mode = useAtomValue(modeAtom)
    const query = useCrabPnLV2ChartData()

 
    const pnlSeries = query?.data?.data.map((x: ChartDataInfo) => ([ x.timestamp, x.crabPnL*100 ])) ;
    const crabEthSeries = query?.data?.data.map((x: ChartDataInfo) => ([ x.timestamp, x.crabEth ])) ;
    const crabUsdSeries = query?.data?.data.map((x: ChartDataInfo) => ([ x.timestamp, x.crabUsd ])) ;
    const ethUsdSeries = query?.data?.data.map((x: ChartDataInfo) => ([ x.timestamp, x.ethUsd ])) ;
    const zeroSeries = [{ price: 0, color: '#9dbdba' }]


    const options = {
      chart: {
       // backgroundColor: 'transparent',
        zoomType: 'xy',

      },
      title: {
        text: ''
      },
      xAxis: {
        type: 'datetime'
      },
      yAxis: [{ //--- Left yAxis
        title: {
            text: ''
        }
     }, { //--- Right yAxis
        title: {
            text: ''
        },
        opposite: true
      }],
      
      series: [{
        type: 'area',
        name: 'PnL',
        yAxis: 1,
        data: pnlSeries,
      }
      ,{
        yAxis: 1,
        name: 'Crab/Eth',
        data: crabEthSeries
      },
      {
        yAxis: 0,
        name: 'Crab/Usd',
        data: crabUsdSeries
      }
      ,{
        yAxis: 0,
        name: 'Eth/Usd',
        data: ethUsdSeries
      }
    ]
    
  }

 

    return (
        <div className={classes.container}>
        <div style={{ display: 'flex', marginTop: '32px' }}>
            <Typography variant="h5" color="primary" style={{}}>
            Strategy Performance (PnL)
            </Typography>
        </div>


        <div className={classes.payoffContainer} style={{ maxHeight: 'none' }}>
            <div style={{ flex: '1 1 0', marginTop: '8px' }}>
                {pnlSeries ? (
                <HighchartsReact highcharts={Highcharts} options={options}  />
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



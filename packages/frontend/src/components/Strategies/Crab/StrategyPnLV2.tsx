import { Box, CircularProgress, IconButton, Typography,  Hidden, TextField, Tooltip,  InputAdornment, } from '@material-ui/core'
import { createStyles, makeStyles } from '@material-ui/core/styles'
import React, { memo, useState } from 'react'
import dynamic from 'next/dynamic'
import useAppMemo from '@hooks/useAppMemo'
import { crabV2DaysAtom, useCrabPnLV2ChartData } from 'src/state/ethPriceCharts/atoms'
import InfoIcon from '@material-ui/icons/InfoOutlined'
import { atom, useAtom, useAtomValue } from 'jotai'
import { graphOptions } from '@constants/diagram'
import LegendBox from '@components/LegendBox'


export type ChartDataInfo = {
    timestamp: number
    ethUsd: number
    crabEth: number 
    crabUsd: number
    crabPnL: number
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
      marginBottom: theme.spacing(5),
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
const Chart = dynamic(() => import('kaktana-react-lightweight-charts'), { ssr: false })

const modeAtom = atom<ChartType>((get) => {
    const tradeType = get(chartTradeTypeAtom)
  
    if (tradeType === 0) return ChartType.PNL
  
    return ChartType.PNL
})

function StrategyPnLV2() {
    
    const classes = useStyles()
    const [days, setDays] = useAtom(crabV2DaysAtom)
    const mode = useAtomValue(modeAtom)
    const [tradeType, setTradeType] = useAtom(chartTradeTypeAtom)
    const query = useCrabPnLV2ChartData()

 
    const pnlSeries = query?.data?.data.map((x: ChartDataInfo) => ({ time: x.timestamp, value:x.crabPnL*100 })) ;
  

    const chartOptions = useAppMemo(() => {
        return {
            ...graphOptions,
            localization: {
            priceFormatter: (num: number) => num.toFixed(2) + '%',
            },
        }
        
    })

    const startTimestamp = useAppMemo(() => (pnlSeries && pnlSeries.length > 0 ? pnlSeries[0].time : 0), [pnlSeries])
    const endTimestamp = useAppMemo(
        () => (pnlSeries && pnlSeries.length > 0 ? pnlSeries[pnlSeries.length - 1].time : 0),
        [pnlSeries],
    )

    // plot line data
    const lineSeries = useAppMemo(() => {
        if ( !pnlSeries || pnlSeries.length === 0) return

        if (mode === ChartType.PNL)
        return [
            {
              data: pnlSeries, legend: 'CrabV2 PNL (%) '
            }
        ]
    }, [  pnlSeries, mode])


    return (
        <div className={classes.container}>
        <div style={{ display: 'flex', marginTop: '32px' }}>
            <Typography variant="h5" color="primary" style={{}}>
            Strategy Performance (PnL)
            </Typography>
        </div>


        <div className={classes.payoffContainer} style={{ maxHeight: 'none' }}>
            <div style={{ flex: '1 1 0', marginTop: '8px' }}>
                {lineSeries ? (
                <Chart
                    from={startTimestamp}
                    to={endTimestamp}
                    legend={mode}
                    options={chartOptions}
                    lineSeries={lineSeries}
                    autoWidth
                    // width={1000}
                    height={300}
                    darkTheme
                />
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



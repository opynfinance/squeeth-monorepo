import {
  Box,
  createStyles,
  makeStyles,
  CircularProgress,
  InputLabel,
  TextFieldProps,
  TextField,
  Divider,
} from '@material-ui/core'
import dynamic from 'next/dynamic'
import { useAtom } from 'jotai'
import React, { memo } from 'react'
import Grid from '@material-ui/core/Grid'
import DateFnsUtils from '@date-io/date-fns'
import { DatePicker, MuiPickersUtilsProvider } from '@material-ui/pickers'

import { graphOptions } from '@constants/diagram'
import {
  longPayoffFilterEndDateAtom,
  longPayoffFilterStartDateAtom,
  useLongChartData,
} from 'src/state/ethPriceCharts/atoms'
import LegendBox from '@components/LegendBox'
import useAppMemo from '@hooks/useAppMemo'

const Chart = dynamic(() => import('kaktana-react-lightweight-charts'), { ssr: false })

const useStyles = makeStyles((theme) =>
  createStyles({
    label: {
      fontWeight: 500,
    },
    payoffContainer: {
      [theme.breakpoints.up('sm')]: {
        maxHeight: '310px',
      },
    },
    legendBox: {
      display: 'flex',
      gap: '16px',
      marginTop: '24px',
      justifyContent: 'center',
    },
    daysInput: {
      width: '200px',
      [theme.breakpoints.down('sm')]: {
        width: 'auto',
      },
    },
    daysInputLabel: {
      fontSize: '1rem',
      [theme.breakpoints.down('sm')]: {
        fontSize: '0.9rem',
      },
    },
    grid: {
      rowGap: '24px',
      columnGap: '24px',
      marginRight: 'auto',
      padding: theme.spacing(1),
    },
    divider: {
      width: '15px',
      backgroundColor: '#8C8D8D',
      height: '1.5px',
      position: 'relative',
      top: '6px',
    },
  }),
)

const useTextFieldStyles = makeStyles((theme) =>
  createStyles({
    labelRoot: {
      color: '#8C8D8D',
      fontSize: '14px',
      fontWeight: 500,
    },
    inputRoot: {
      padding: '10px 16px',
      fontSize: '15px',
      fontWeight: 500,
      fontFamily: 'DM Mono',
      width: '14ch',
      border: '2px solid #303436',
      borderRadius: '12px',
    },
    inputFocused: {
      borderColor: theme.palette.primary.main,
    },
  }),
)

const CustomTextField: React.FC<TextFieldProps> = ({ inputRef, label, InputProps, id, variant, ...props }) => {
  const classes = useTextFieldStyles()

  return (
    <Box display="flex" flexDirection="column" gridGap="4px">
      <InputLabel htmlFor={id} classes={{ root: classes.labelRoot }}>
        {label}
      </InputLabel>
      <TextField
        id={id}
        InputProps={{
          classes: {
            root: classes.inputRoot,
            focused: classes.inputFocused,
          },
          disableUnderline: true,
          ...InputProps,
        }}
        {...props}
      />
    </Box>
  )
}

function LongChartPayoff() {
  const [startDate, setStartDate] = useAtom(longPayoffFilterStartDateAtom)
  const [endDate, setEndDate] = useAtom(longPayoffFilterEndDateAtom)

  const query = useLongChartData()

  const longEthPNL = query.data?.longEthPNL
  const longSeries = query.data?.longSeries
  const positionSizeSeries = query.data?.positionSizeSeries
  const squeethIsLive = query.data?.squeethIsLive

  const classes = useStyles()

  // plot line data
  const lineSeries = useAppMemo(() => {
    if (!longEthPNL || !longSeries || longSeries.length === 0 || !positionSizeSeries || !squeethIsLive) return

    const liveIndex = Math.max(
      0,
      squeethIsLive.findIndex((val: boolean) => val),
    ) // return 0 when there is no live data

    return [
      {
        data: longEthPNL,
        legend: 'Long ETH PNL (%)',
        options: {
          color: '#CDAEFB',
        },
      },
      {
        data: longSeries.slice(0, liveIndex),
        legend: `Long Squeeth PNL (%) Simulated incl. premiums`,
        options: {
          color: '#00E396',
        },
      },
      {
        data: longSeries.slice(liveIndex),
        legend: `Long Squeeth PNL (%) LIVE (incl. premiums)`,
        options: {
          color: '#70E3F6',
        },
      },
    ]

    return []
  }, [longEthPNL, longSeries, positionSizeSeries, squeethIsLive])

  const chartOptions = useAppMemo(() => {
    return {
      ...graphOptions,
      localization: {
        priceFormatter: (num: number) => (num ? num.toFixed(2) + '%' : ''),
      },
    }
  }, [])

  const startTimestamp = useAppMemo(() => (longSeries && longSeries.length > 0 ? longSeries[0].time : 0), [longSeries])

  const endTimestamp = useAppMemo(
    () => (longSeries && longSeries.length > 0 ? longSeries[longSeries.length - 1].time : 0),
    [longSeries],
  )

  return (
    <>
      <MuiPickersUtilsProvider utils={DateFnsUtils}>
        <Box display="flex" alignItems="center" gridGap="16px" marginTop="16px">
          <DatePicker
            label="Start Date"
            placeholder="MM/DD/YYYY"
            format={'MM/dd/yyyy'}
            value={startDate}
            maxDate={new Date()}
            onChange={(d) => setStartDate(d || new Date())}
            animateYearScrolling={false}
            autoOk={true}
            clearable
            TextFieldComponent={CustomTextField}
          />
          <Divider orientation="horizontal" className={classes.divider} />
          <DatePicker
            label="End Date"
            placeholder="MM/DD/YYYY"
            format={'MM/dd/yyyy'}
            value={endDate}
            maxDate={new Date()}
            onChange={(d) => setEndDate(d || new Date())}
            animateYearScrolling={false}
            autoOk={true}
            clearable
            TextFieldComponent={CustomTextField}
          />
        </Box>
      </MuiPickersUtilsProvider>

      <div className={classes.payoffContainer}>
        <div style={{ marginTop: '8px' }}>
          {lineSeries ? (
            <Chart
              from={startTimestamp}
              to={endTimestamp}
              legend={'LONG PNL'}
              options={chartOptions}
              lineSeries={lineSeries}
              autoWidth
              height={300}
              darkTheme
            />
          ) : (
            <Box display="flex" height="300px" width={1} alignItems="center" justifyContent="center">
              <CircularProgress size={40} color="secondary" />
            </Box>
          )}

          <div className={classes.legendBox}>
            {lineSeries && lineSeries[0].data.length > 0 && <LegendBox bgColor="#CDAEFB" text="ETH PNL" />}
            {lineSeries && lineSeries[1].data.length > 0 && (
              <LegendBox
                bgColor="#00E396"
                text="Squeeth Simulated PnL"
                tooltip="The Squeeth Simulated PnL comes from using at the money implied vol from Deribit"
              />
            )}
            {lineSeries && lineSeries[2].data.length > 0 && <LegendBox bgColor="#70E3F6" text="Squeeth PNL" />}
          </div>
        </div>
      </div>
    </>
  )
}

const LongChartPayoffMemoized = memo(LongChartPayoff)

export { LongChartPayoffMemoized as LongChartPayoff }

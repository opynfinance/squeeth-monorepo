import React, { useMemo } from 'react'
import {
  Box,
  Typography,
  Tooltip,
  TextField,
  InputLabel,
  TextFieldProps,
  Divider,
  CircularProgress,
} from '@material-ui/core'
import HelpOutlineIcon from '@material-ui/icons/HelpOutline'
import clsx from 'clsx'
import { useAtom } from 'jotai'
import { useAtomValue } from 'jotai/utils'
import { DatePicker, MuiPickersUtilsProvider } from '@material-ui/pickers'
import DateFnsUtils from '@date-io/date-fns'
import { makeStyles, createStyles } from '@material-ui/core/styles'
import HighchartsReact from 'highcharts-react-official'
import Highcharts from 'highcharts'
import differenceInCalendarDays from 'date-fns/differenceInCalendarDays'

import useStyles from '@components/Strategies/Crab/useStyles'
import {
  crabStrategyVaultAtomV2,
  useCrabPnLV2ChartData,
  crabv2StrategyFilterEndDateAtom,
  crabv2StrategyFilterStartDateAtom,
} from '@state/crab/atoms'
import { BIG_ZERO, CRABV2_START_DATE } from '@constants/index'
import { useETHPrice } from '@hooks/useETHPrice'
import { useOSQTHPrice } from '@hooks/useOSQTHPrice'
import { formatCurrency, formatNumber } from '@utils/formatter'
import { pnlGraphOptions } from '@constants/diagram'
import useAppMemo from '@hooks/useAppMemo'

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

export type ChartDataInfo = {
  timestamp: number
  crabPnL: number
}

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

const PerformanceMetric: React.FC<{ label: string; value: number }> = ({ label, value }) => {
  const classes = useStyles()

  return (
    <Box display="flex" justifyContent="flex-end" gridGap="6px">
      <Typography className={classes.textSmall}>{label}</Typography>

      <Box minWidth="6ch" display="flex" justifyContent="flex-end">
        <Typography
          className={clsx(
            classes.textSmall,
            classes.textMonospace,
            value >= 0 ? classes.colorSuccess : classes.colorError,
          )}
        >
          {value >= 0 && '+'}
          {formatNumber(value)}%
        </Typography>
      </Box>
    </Box>
  )
}

const StrategyPerformance: React.FC = () => {
  const [startDate, setStartDate] = useAtom(crabv2StrategyFilterStartDateAtom)
  const [endDate, setEndDate] = useAtom(crabv2StrategyFilterEndDateAtom)

  const vault = useAtomValue(crabStrategyVaultAtomV2)
  const ethPrice = useETHPrice()
  const { data: osqthPrice } = useOSQTHPrice()
  const query = useCrabPnLV2ChartData()

  const crabUsdPnlSeries = query?.data?.data.map((x: ChartDataInfo) => [x.timestamp * 1000, x.crabPnL * 100])

  const series = [
    {
      name: 'Crab/USD 🦀  % Return',
      yAxis: 0,
      data: crabUsdPnlSeries,
      tooltip: {
        valueDecimals: 2,
        valueSuffix: '%',
      },
      color: '#70E3F6',
    },
  ]

  const axes = {
    yAxis: [
      {
        // Left yAxis
        title: {
          text: '',
        },
        labels: {
          style: {
            color: '#BABBBB',
          },
        },
        gridLineColor: 'rgba(221,221,221,0.1)',
      },
    ],
  }

  const chartOptions = useAppMemo(() => {
    return {
      ...pnlGraphOptions,
      series: series,
      ...axes,
    }
  })

  const classes = useStyles()

  const isLoadingChartData = typeof crabUsdPnlSeries === 'undefined'
  const numberOfDays = differenceInCalendarDays(endDate, startDate)
  const hasData = isLoadingChartData ? false : crabUsdPnlSeries.length > 0

  const historicalReturns = hasData ? crabUsdPnlSeries[crabUsdPnlSeries.length - 1][1] : 0
  const annualizedReturns = useMemo(() => {
    // compounded annually
    return (Math.pow(1 + historicalReturns / 100, 365 / numberOfDays) - 1) * 100
  }, [historicalReturns, numberOfDays])

  const vaultCollateral = vault?.collateralAmount ?? BIG_ZERO
  const vaultDebt = vault?.shortAmount ?? BIG_ZERO

  const collateralValue = vaultCollateral.multipliedBy(ethPrice)
  const debtValue = vaultDebt.multipliedBy(osqthPrice)
  const tvl = collateralValue.minus(debtValue).integerValue()

  return (
    <Box display="flex" flexDirection="column" gridGap="8px">
      <Typography variant="h3" className={classes.sectionTitle}>
        Strategy Performance
      </Typography>
      <Box display="flex" alignItems="baseline" gridGap="12px">
        <Typography
          variant="h2"
          className={clsx(
            classes.heading,
            classes.textMonospace,
            annualizedReturns >= 0 ? classes.colorSuccess : classes.colorError,
          )}
        >
          {annualizedReturns >= 0 && '+'}
          {formatNumber(annualizedReturns)}%
        </Typography>
        <Typography className={classes.description}>Annual USD Return</Typography>

        <Box position="relative" top="3px">
          <Tooltip title={`Historical returns, selected dates`}>
            <HelpOutlineIcon fontSize="small" className={classes.infoIcon} />
          </Tooltip>
        </Box>
      </Box>

      <Box display="flex" gridGap="8px">
        <Typography className={clsx(classes.description, classes.textMonospace)}>
          {formatCurrency(tvl.toNumber(), 0)}
        </Typography>
        <Typography className={classes.description}>TVL</Typography>
      </Box>

      <Box display="flex" justifyContent="space-between" alignItems="flex-end" gridGap="12px" flexWrap="wrap">
        <div>
          <MuiPickersUtilsProvider utils={DateFnsUtils}>
            <Box display="flex" alignItems="center" gridGap="16px" marginTop="16px">
              <DatePicker
                id="start-date-strategy-performance"
                label="Start Date"
                placeholder="MM/DD/YYYY"
                format={'MM/dd/yyyy'}
                value={startDate}
                minDate={CRABV2_START_DATE}
                onChange={(d) => setStartDate(d || new Date())}
                animateYearScrolling={false}
                autoOk={true}
                clearable
                TextFieldComponent={CustomTextField}
              />

              <Divider orientation="horizontal" className={classes.divider} />

              <DatePicker
                id="end-date-strategy-performance"
                label="End Date"
                placeholder="MM/DD/YYYY"
                format={'MM/dd/yyyy'}
                value={endDate}
                minDate={startDate}
                onChange={(d) => setEndDate(d || new Date())}
                animateYearScrolling={false}
                autoOk={true}
                clearable
                TextFieldComponent={CustomTextField}
              />
            </Box>
          </MuiPickersUtilsProvider>
        </div>

        <Box display="flex" flexDirection="column" gridGap="4px">
          <PerformanceMetric label="Historical Returns" value={historicalReturns} />
          <PerformanceMetric label="Annualized" value={annualizedReturns} />
        </Box>
      </Box>

      <Box marginTop="12px">
        {crabUsdPnlSeries ? (
          <HighchartsReact highcharts={Highcharts} options={chartOptions} />
        ) : (
          <Box display="flex" height="346px" width={1} alignItems="center" justifyContent="center">
            <CircularProgress size={40} className={classes.loadingSpinner} />
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default StrategyPerformance

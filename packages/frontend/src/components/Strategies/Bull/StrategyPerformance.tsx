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

import useStyles from '@components/Strategies/styles'
import {
  bullStrategyFilterEndDateAtom,
  bullStrategyFilterStartDateAtom,
  useBullPnLChartData,
  bullDepositedEthInEulerAtom,
  bullCrabBalanceAtom,
  bullEulerUSDCDebtAtom,
} from '@state/bull/atoms'
import { crabUSDValueAtom } from '@state/crab/atoms'
import { BULL_START_DATE } from '@constants/index'
import { formatNumber } from '@utils/formatter'
import { pnlGraphOptions } from '@constants/diagram'
import useAppMemo from '@hooks/useAppMemo'
import { useOnChainETHPrice } from '@hooks/useETHPrice'
import { toTokenAmount } from '@utils/calculations'

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
  bullEthPnl: number
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

const TooltipTitle = () => (
  <>
    {'Annualized return based on selected dates.'}
    <br />
    {'Past performance does not indicate future returns.'}
  </>
)

const StrategyPerformance: React.FC = () => {
  const ethDepositedInEuler = useAtomValue(bullDepositedEthInEulerAtom)
  const bullCrabBalance = useAtomValue(bullCrabBalanceAtom)
  const eulerUSDCDebt = useAtomValue(bullEulerUSDCDebtAtom)
  const crabUSDValue = useAtomValue(crabUSDValueAtom)
  const ethPrice = useOnChainETHPrice()

  const [startDate, setStartDate] = useAtom(bullStrategyFilterStartDateAtom)
  const [endDate, setEndDate] = useAtom(bullStrategyFilterEndDateAtom)

  const query = useBullPnLChartData()
  const bullEthPnlSeries = query?.data?.data.map((x: ChartDataInfo) => [x.timestamp * 1000, x.bullEthPnl])

  const series = [
    {
      name: 'Bull/ETH 🧘🐂 % Return',
      yAxis: 0,
      data: bullEthPnlSeries,
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
    const { chart, ...restOptions } = pnlGraphOptions

    return {
      ...restOptions,
      ...axes,
      chart: {
        ...chart,
        marginLeft: '48',
      },
      series: series,
    }
  })

  const classes = useStyles()

  const numberOfDays = differenceInCalendarDays(endDate, startDate)
  const hasData = bullEthPnlSeries?.length > 0 ?? false

  const historicalReturns = hasData ? bullEthPnlSeries[bullEthPnlSeries.length - 1][1] : 0
  const annualizedReturns = useMemo(() => {
    return (Math.pow(1 + historicalReturns / 100, 365 / numberOfDays) - 1) * 100
  }, [historicalReturns, numberOfDays])

  // tvl = ethInEuler + (crabInBull * crabPriceInETH) - (debtInEuler / ethPrice)
  const crabPriceInETH = toTokenAmount(crabUSDValue, 18).div(ethPrice)
  const collateralValue = ethDepositedInEuler.plus(bullCrabBalance.times(crabPriceInETH))
  const debtValue = eulerUSDCDebt.div(ethPrice)

  const isLoadingTVL =
    ethDepositedInEuler.isZero() ||
    bullCrabBalance.isZero() ||
    crabUSDValue.isZero() ||
    eulerUSDCDebt.isZero() ||
    ethPrice.isZero()
  const tvl = isLoadingTVL ? 0 : collateralValue.minus(debtValue).integerValue().toNumber()

  return (
    <Box display="flex" flexDirection="column" gridGap="8px">
      <Typography variant="h3" className={classes.sectionTitle}>
        Strategy Performance
      </Typography>
      {bullEthPnlSeries ? (
        <>
          <Box display="flex" alignItems="baseline" gridColumnGap="12px" gridRowGap="4px" flexWrap="wrap">
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

            <Box display="flex" alignItems="baseline" gridGap="12px">
              <Typography className={classes.description}>Annualized ETH Return</Typography>

              <Box position="relative" top="3px">
                <Tooltip title={<TooltipTitle />}>
                  <HelpOutlineIcon fontSize="small" className={classes.infoIcon} />
                </Tooltip>
              </Box>
            </Box>
          </Box>

          <Box display="flex" gridGap="12px">
            <Typography className={clsx(classes.description, classes.textMonospace)}>
              {formatNumber(tvl, 0) + ' ETH'}
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
                    minDate={BULL_START_DATE}
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

            <Box display="flex" flexDirection="column" gridGap="4px" flex="1" flexBasis="200px">
              <PerformanceMetric label="Historical Returns" value={historicalReturns} />
              <PerformanceMetric label="Annualized" value={annualizedReturns} />
            </Box>
          </Box>

          <Box marginTop="12px">
            {bullEthPnlSeries ? (
              <HighchartsReact highcharts={Highcharts} options={chartOptions} />
            ) : (
              <Box display="flex" height="346px" width={1} alignItems="center" justifyContent="center">
                <CircularProgress size={40} className={classes.loadingSpinner} />
              </Box>
            )}
          </Box>
        </>
      ) : (
        <Box display="flex" alignItems="flex-start" marginTop="8px" height="500px">
          <Box display="flex" alignItems="center" gridGap="15px">
            <CircularProgress size={15} className={classes.loadingSpinner} />
            <Typography className={classes.text}>Fetching strategy performance...</Typography>
          </Box>
        </Box>
      )}
    </Box>
  )
}

export default StrategyPerformance

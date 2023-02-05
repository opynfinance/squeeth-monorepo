import React, { useMemo } from 'react'
import { useAtomValue } from 'jotai'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  ReferenceDot,
  ReferenceArea,
  Label,
  Tooltip,
  TooltipProps,
} from 'recharts'
import { Box, useTheme, Fade, CircularProgress, Typography, useMediaQuery } from '@material-ui/core'
import BigNumber from 'bignumber.js'
import { makeStyles } from '@material-ui/core/styles'

import { currentImpliedFundingAtom } from '@state/controller/atoms'
import { ethPriceAtLastHedgeAtomV2 } from '@state/crab/atoms'
import { calculateIV, toTokenAmount } from '@utils/calculations'
import { useOnChainETHPrice } from '@hooks/useETHPrice'
import { formatNumber, formatCurrency } from '@utils/formatter'
import useStyles from '@components/Strategies/styles'
import { FUNDING_PERIOD } from '@constants/index'
import { useCrabProfitData } from '@state/crab/hooks'
import { getNextHedgeDate } from '@state/crab/utils'
import { getCrabProfitDataPoints } from '@utils/strategyPayoff'

const useTooltipStyles = makeStyles(() => ({
  root: {
    backgroundColor: 'rgba(247,247,247,0.85)',
    padding: '4px 8px',
  },
  label: {
    fontSize: '12px',
    fontFamily: 'DM Mono',
    color: 'rgb(51, 51, 51)',
  },
  value: {
    fontSize: '12px',
    fontFamily: 'DM Mono',
    color: 'rgb(51, 51, 51)',
  },
}))

const CustomTooltip: React.FC<TooltipProps<any, any>> = ({ active, payload }) => {
  const classes = useTooltipStyles()

  if (active && payload && payload.length) {
    const strategyReturn = payload[0].payload.strategyReturn
    const ethPrice = payload[0].payload.ethPrice

    return (
      <div className={classes.root}>
        <Typography className={classes.label}>
          <b>{formatCurrency(ethPrice)}</b> {`ETH/USDC`}
        </Typography>
        <Typography className={classes.value}>
          {`Crab return: `}
          <b>{formatNumber(strategyReturn, 4)}%</b>
        </Typography>
      </div>
    )
  }

  return null
}

const CustomActiveDot = (props: any) => {
  const { cx, cy, value, fill } = props

  if (!value) {
    return null
  }
  return <rect x={cx - 1.5} y={cy - 7} width={3} height={14} strokeWidth={0} fill={fill} />
}

const CandyBar = (props: any) => {
  const { x, y, width, height, fill, stroke } = props

  const barX = x
  const barY = height < 0 ? y + height : y
  const barWidth = width
  const barHeight = Math.abs(height)

  return (
    <>
      <rect x={barX} y={barY} width={barWidth} height={barHeight} fill={fill} />
      <rect x={barX} y={barY} width={1} height={barHeight} fill={stroke} />
      <rect x={barX + barWidth} y={barY} width={1} height={barHeight} fill={stroke} />
    </>
  )
}

const Chart: React.FC<{ currentImpliedFunding: number }> = ({ currentImpliedFunding }) => {
  const ethPriceAtLastHedgeValue = useAtomValue(ethPriceAtLastHedgeAtomV2)
  const ethPrice = useOnChainETHPrice()

  const currentEthPrice = Number(ethPrice)
  const { profitData, loading } = useCrabProfitData()

  const {
    dataPoints: data,
    lowerPriceBandForProfitability,
    upperPriceBandForProfitability,
    currentProfit,
  } = useMemo(() => {
    const nextHedgeTime = getNextHedgeDate(new Date(profitData.time * 1000)).getTime()
    const timeUntilNextHedge = nextHedgeTime - new Date(profitData.time * 1000).getTime()
    console.log('timeUntilNextHedge', timeUntilNextHedge)
    return getCrabProfitDataPoints(
      profitData.ethPriceAtHedge,
      profitData.nf,
      profitData.shortAmt,
      profitData.collat,
      profitData.oSqthPrice,
      30,
      currentEthPrice,
      2,
    )
  }, [
    currentEthPrice,
    profitData.collat,
    profitData.ethPriceAtHedge,
    profitData.nf,
    profitData.oSqthPrice,
    profitData.shortAmt,
    profitData.time,
  ])

  const theme = useTheme()
  const successColor = theme.palette.success.main
  const errorColor = theme.palette.error.main

  const isMobileBreakpoint = useMediaQuery(theme.breakpoints.down('xs'))

  return (
    <Fade in={true}>
      <Box height={300} width="100%" display="flex" justifyContent="flex-start">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto-start-reverse">
                <polygon points="0 0, 10 5, 0 10" fill="#fff" opacity="0.5" />
              </marker>

              <marker id="dot" viewBox="0 0 16 16" refX="8" refY="8" markerWidth="8" markerHeight="8">
                <circle cx="8" cy="8" r="8" fill="#ffffff80" />
              </marker>

              {/* https://stackoverflow.com/a/12263962/5733330 */}
              <filter x="0" y="0" width="1" height="1" id="removebackground">
                <feFlood floodColor={theme.palette.background.default} />
                <feComposite in="SourceGraphic" />
              </filter>
            </defs>

            <XAxis
              height={1}
              type="number"
              dataKey="ethPrice"
              domain={isMobileBreakpoint ? ['dataMin - 20', 'dataMax + 20'] : ['dataMin - 40', 'dataMax + 200']}
              tick={false}
              strokeDasharray="5,5"
              strokeOpacity="0.5"
              stroke="#fff"
              markerEnd="url(#arrowhead)"
              markerStart="url(#dot)"
            >
              <Label
                value="ETH Price"
                position="insideBottomRight"
                offset={14}
                fill="#ffffff80"
                enableBackground={'fill'}
              />
            </XAxis>
            <YAxis
              width={1}
              type="number"
              dataKey="strategyReturn"
              tick={false}
              domain={isMobileBreakpoint ? ['dataMin - .25', 'dataMax + .25'] : ['dataMin - 0.05', 'dataMax + 0.05']}
              strokeDasharray="5,5"
              strokeOpacity="0.5"
              stroke="#fff"
              markerStart="url(#arrowhead)"
              yAxisId="0"
            >
              <Label
                value={isMobileBreakpoint ? 'Crab' : 'Crab Strategy'}
                position="insideTopLeft"
                offset={14}
                fill="#ffffff80"
              />
            </YAxis>

            <ReferenceArea
              shape={<CandyBar />}
              x1={lowerPriceBandForProfitability.ethPrice}
              x2={upperPriceBandForProfitability.ethPrice}
              fill={successColor + '16'}
              stroke={successColor}
            />

            <Tooltip
              wrapperStyle={{ outline: 'none', zIndex: 201 }}
              cursor={{ stroke: '#fff', strokeOpacity: '0.5', strokeWidth: 1 }}
              content={<CustomTooltip />}
            />

            <Line
              type="monotone"
              dataKey="strategyReturnNegative"
              stroke={errorColor}
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
              activeDot={<CustomActiveDot />}
            />
            <Line
              type="monotone"
              dataKey="strategyReturnPositive"
              stroke={successColor}
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
              activeDot={<CustomActiveDot />}
            />

            <ReferenceDot
              x={lowerPriceBandForProfitability.ethPrice}
              y={lowerPriceBandForProfitability.strategyReturn}
              r={0}
            >
              <Label
                fontFamily={'DM Mono'}
                fontWeight={500}
                value={'$' + formatNumber(lowerPriceBandForProfitability.ethPrice, 0)}
                position="insideBottomRight"
                offset={8}
                fill="#ffffffcc"
              />
            </ReferenceDot>
            <ReferenceDot
              x={upperPriceBandForProfitability.ethPrice}
              y={upperPriceBandForProfitability.strategyReturn}
              r={0}
            >
              <Label
                fontFamily={'DM Mono'}
                fontWeight={500}
                value={'$' + formatNumber(upperPriceBandForProfitability.ethPrice, 0)}
                position="insideBottomLeft"
                offset={8}
                fill="#ffffffcc"
              />
            </ReferenceDot>

            <ReferenceDot
              x={currentEthPrice}
              y={currentProfit.strategyReturn}
              r={5}
              fill={currentProfit.strategyReturn < 0 ? errorColor : successColor}
              strokeWidth={0}
            >
              <Label
                fontFamily="DM Mono"
                fontWeight={500}
                value={'$' + formatNumber(currentEthPrice, 0)}
                position="insideTop"
                offset={20}
                fill={currentProfit.strategyReturn < 0 ? errorColor : successColor}
                filter="url(#removebackground)"
              />
            </ReferenceDot>
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </Fade>
  )
}

function ChartWrapper() {
  const currentImpliedFunding = useAtomValue(currentImpliedFundingAtom)
  const classes = useStyles()

  if (currentImpliedFunding === 0) {
    return (
      <Box display="flex" height="300px" width={1} alignItems="center" justifyContent="center">
        <CircularProgress size={40} className={classes.loadingSpinner} />
      </Box>
    )
  }
  return <Chart currentImpliedFunding={currentImpliedFunding} />
}

export default ChartWrapper

import React, { useMemo } from 'react'
import { useAtomValue } from 'jotai'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceDot, ReferenceArea, Label } from 'recharts'
import { Box, useTheme, Fade } from '@material-ui/core'
import BigNumber from 'bignumber.js'

import { currentImpliedFundingAtom } from '@state/controller/atoms'
import { ethPriceAtLastHedgeAtomV2 } from '@state/crab/atoms'
import { toTokenAmount } from '@utils/calculations'
import { useOnChainETHPrice } from '@hooks/useETHPrice'
import { formatNumber } from '@utils/formatter'

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

// generate data from -percentRange to +percentRange
const getDataPoints = (funding: number, ethPriceAtLastHedge: number, percentRange: number) => {
  const dataPoints = []

  const starting = new BigNumber(-percentRange)
  const increment = new BigNumber(0.1)
  const ending = new BigNumber(percentRange)

  let current = starting
  while (current.lte(ending)) {
    const ethReturn = current.div(100).toNumber()

    const crabReturn = (funding - Math.pow(ethReturn, 2)) * 100
    const crabReturnPositive = crabReturn >= 0 ? crabReturn : null
    const crabReturnNegative = crabReturn < 0 ? crabReturn : null

    dataPoints.push({
      ethPrice: ethPriceAtLastHedge + ethReturn * ethPriceAtLastHedge,
      crabReturn,
      crabReturnPositive,
      crabReturnNegative,
    })

    current = current.plus(increment)
  }

  return dataPoints
}

const Chart: React.FC<{ currentImpliedFunding: number }> = ({ currentImpliedFunding }) => {
  const ethPriceAtLastHedgeValue = useAtomValue(ethPriceAtLastHedgeAtomV2)
  const ethPrice = useOnChainETHPrice()

  const funding = 2 * currentImpliedFunding // for 2 days
  const ethPriceAtLastHedge = Number(toTokenAmount(ethPriceAtLastHedgeValue, 18))
  const currentEthPrice = Number(ethPrice)
  const profitableBoundsPercent = Math.sqrt(funding)
  const lowerPriceBandForProfitability = ethPriceAtLastHedge - profitableBoundsPercent * ethPriceAtLastHedge
  const upperPriceBandForProfitability = ethPriceAtLastHedge + profitableBoundsPercent * ethPriceAtLastHedge

  const data = useMemo(() => {
    const percentRange = profitableBoundsPercent * 4 * 100 // 4x the profitable move percent
    return getDataPoints(funding, ethPriceAtLastHedge, percentRange)
  }, [funding, ethPriceAtLastHedge, profitableBoundsPercent])

  const getCrabReturn = (ethPriceVal: number) => {
    const ethReturn = (ethPriceVal - ethPriceAtLastHedge) / ethPriceAtLastHedge
    return (funding - Math.pow(ethReturn, 2)) * 100
  }

  const theme = useTheme()
  const successColor = theme.palette.success.main
  const errorColor = theme.palette.error.main

  const currentCrabReturn = getCrabReturn(currentEthPrice)

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
              domain={['dataMin - 40', 'dataMax + 200']}
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
              dataKey="crabReturn"
              tick={false}
              domain={['dataMin - 0.5', 'dataMax + 0.5']}
              strokeDasharray="5,5"
              strokeOpacity="0.5"
              stroke="#fff"
              markerStart="url(#arrowhead)"
              yAxisId="0"
            >
              <Label value="Crab Strategy" position="insideTopLeft" offset={14} fill="#ffffff80" />
            </YAxis>

            <Line
              type="monotone"
              dataKey="crabReturnNegative"
              stroke={errorColor}
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="crabReturnPositive"
              stroke={successColor}
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
            />

            <ReferenceArea
              shape={<CandyBar />}
              x1={lowerPriceBandForProfitability}
              x2={upperPriceBandForProfitability}
              fill={successColor + '16'}
              stroke={successColor}
            />

            <ReferenceDot x={lowerPriceBandForProfitability} y={getCrabReturn(lowerPriceBandForProfitability)} r={0}>
              <Label
                fontFamily={'DM Mono'}
                fontWeight={500}
                value={'$' + formatNumber(lowerPriceBandForProfitability, 0)}
                position="insideBottomRight"
                offset={8}
                fill="#ffffffcc"
              />
            </ReferenceDot>
            <ReferenceDot x={upperPriceBandForProfitability} y={getCrabReturn(upperPriceBandForProfitability)} r={0}>
              <Label
                fontFamily={'DM Mono'}
                fontWeight={500}
                value={'$' + formatNumber(upperPriceBandForProfitability, 0)}
                position="insideBottomLeft"
                offset={8}
                fill="#ffffffcc"
              />
            </ReferenceDot>

            <ReferenceDot
              x={currentEthPrice}
              y={currentCrabReturn}
              r={5}
              fill={currentCrabReturn < 0 ? errorColor : successColor}
              strokeWidth={0}
            >
              <Label
                fontFamily="DM Mono"
                fontWeight={500}
                value={'$' + formatNumber(currentEthPrice, 0)}
                position="insideTop"
                offset={20}
                fill={currentCrabReturn < 0 ? errorColor : successColor}
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

  if (currentImpliedFunding === 0) {
    return <></>
  }
  return <Chart currentImpliedFunding={currentImpliedFunding} />
}

export default ChartWrapper

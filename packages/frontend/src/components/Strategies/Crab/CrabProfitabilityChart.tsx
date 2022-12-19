import React from 'react'
import dynamic from 'next/dynamic'
import { useAtomValue } from 'jotai'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ReferenceDot,
  ReferenceArea,
} from 'recharts'
import { Box, Typography } from '@material-ui/core'
import BigNumber from 'bignumber.js'

import { dailyHistoricalFundingAtom, currentImpliedFundingAtom } from '@state/controller/atoms'
import { graphOptions } from '@constants/diagram'
import { useProfitableMovePercentV2 } from '@state/crab/hooks'
import { ethPriceAtLastHedgeAtomV2, timeAtLastHedgeAtomV2, crabStrategyCollatRatioAtomV2 } from '@state/crab/atoms'
import { toTokenAmount } from '@utils/calculations'
import { useOnChainETHPrice } from '@hooks/useETHPrice'
import { formatCurrency } from '@utils/formatter'

const Chart = dynamic(() => import('kaktana-react-lightweight-charts'), { ssr: false })

const NUMBER_OF_DAYS = 2

const CandyBar = (props: any) => {
  const { x: oX, y: oY, width: oWidth, height: oHeight, fill } = props

  const x = oX
  const y = oHeight < 0 ? oY + oHeight : oY
  const width = oWidth
  const height = Math.abs(oHeight)

  return (
    <>
      <rect fill={fill} mask="url(#mask-stripe)" x={x} y={y} width={width} height={height} />
      <rect x={x} y={y} width={1} height={height} fill="#67FABF" />
      <rect x={x + width} y={y} width={1} height={height} fill="#67FABF" />
    </>
  )
}

const AxisLabel = ({ axisType, x, y, width, height, children }) => {
  const isVert = axisType === 'yAxis'
  const rot = isVert ? -90 : 0
  const cx = isVert ? -height / 2 : x + width / 2
  const cy = isVert ? y : y + height / 2 + 14
  return (
    <text x={cx} y={cy} transform={`rotate(${rot})`} textAnchor="middle">
      {children}
    </text>
  )
}

const getDataPoints = (funding: number, ethPriceAtLastHedge: number) => {
  const dataPoints = []

  const starting = -20
  const increment = 0.1
  const ending = 20

  let current = starting
  while (current <= ending) {
    const ethReturnPercent = current
    const crabReturn = (funding - Math.pow(ethReturnPercent, 2)) / 100
    const crabReturnPositive = crabReturn > 0 ? crabReturn : null

    dataPoints.push({
      ethPrice: ethPriceAtLastHedge + (ethReturnPercent / 100) * ethPriceAtLastHedge,
      crabReturn,
      crabReturnPositive,
    })

    current += increment
  }
  console.log({ dataPoints })

  return dataPoints
}

const CrabProfitabilityChart: React.FC = () => {
  const dailyHistoricalFunding = useAtomValue(dailyHistoricalFundingAtom)
  const currentImpliedFunding = useAtomValue(currentImpliedFundingAtom)
  const ethPriceAtLastHedgeValue = useAtomValue(ethPriceAtLastHedgeAtomV2)
  const profitableMovePercentV2 = useProfitableMovePercentV2()
  const ethPrice = useOnChainETHPrice()

  const ethPriceAtLastHedge = Number(toTokenAmount(ethPriceAtLastHedgeValue, 18))
  const lowerPriceBandForProfitability = ethPriceAtLastHedge - profitableMovePercentV2 * ethPriceAtLastHedge
  const upperPriceBandForProfitability = ethPriceAtLastHedge + profitableMovePercentV2 * ethPriceAtLastHedge

  console.log({ lowerPriceBandForProfitability, upperPriceBandForProfitability })

  const funding = ((currentImpliedFunding * 365) / 2) * 100
  console.log({ currentImpliedFunding, dailyHistoricalFunding: dailyHistoricalFunding.funding })

  const theoreticalEthReturnForProfitability = Math.sqrt(2 * currentImpliedFunding)

  const theoreticalUpperPriceBandForProfitability =
    ethPriceAtLastHedge + theoreticalEthReturnForProfitability * ethPriceAtLastHedge
  const theoreticalLowerPriceBandForProfitability =
    ethPriceAtLastHedge - theoreticalEthReturnForProfitability * ethPriceAtLastHedge

  //generate data from -20% to 20%
  const data = getDataPoints(funding, ethPriceAtLastHedge)

  const getCrabReturnPercent = (ethPriceVal: number) => {
    const ethReturnPercent = ((ethPriceVal - ethPriceAtLastHedge) / ethPriceAtLastHedge) * 100
    return (funding - Math.pow(ethReturnPercent, 2)) / 100
  }

  console.log({ crabReturnPercent: getCrabReturnPercent(1041) })

  if (funding === 0) {
    return <div>chart</div>
  }

  return (
    <>
      <Box display="flex" flexWrap="wrap" gridGap="32px" marginTop="24px">
        <div>
          <Typography variant="h6">Funding</Typography>
          <Typography variant="body1">{new BigNumber(funding).div(100) + '%'}</Typography>
        </div>
        <div>
          <Typography variant="h6">Lower Price Band</Typography>
          <Typography variant="body1">{lowerPriceBandForProfitability}</Typography>
        </div>
        <div>
          <Typography variant="h6">Upper Price Band</Typography>
          <Typography variant="body1">{upperPriceBandForProfitability}</Typography>
        </div>
        <div>
          <Typography variant="h6">ETH Price At Last Hedge</Typography>
          <Typography variant="body1">{ethPriceAtLastHedge}</Typography>
        </div>
        <div>
          <Typography variant="h6">ETH Price</Typography>
          <Typography variant="body1">{ethPrice.toNumber()}</Typography>
        </div>
        <div>
          <Typography variant="h6">Theoretical Lower Price Band</Typography>
          <Typography variant="body1">{theoreticalLowerPriceBandForProfitability}</Typography>
        </div>
        <div>
          <Typography variant="h6">Theoretical Upper Price Band</Typography>
          <Typography variant="body1">{theoreticalUpperPriceBandForProfitability}</Typography>
        </div>
      </Box>
      <Box height={300} width={600} marginTop="64px">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart width={500} height={300} data={data}>
            <XAxis type="number" dataKey="ethPrice" domain={['dataMin - 50', 'dataMax + 50']} tick={false} />
            <YAxis type="number" dataKey="crabReturn" tick={false} domain={['dataMin - 1', 'dataMax + 1']} />

            {/* <Legend /> */}
            {/* <Line type="monotone" dataKey="ethPrice" stroke="#8884d8" activeDot={{ r: 8 }} /> */}

            <Tooltip />

            <Line type="monotone" dataKey="crabReturn" stroke="#FA7B67" dot={false} strokeWidth={1} />
            <Line type="monotone" dataKey="crabReturnPositive" stroke="#67FABF" dot={false} strokeWidth={1} />

            <ReferenceArea
              fill={'rgba(103, 250, 191, 0.09)'}
              shape={<CandyBar />}
              x1={theoreticalLowerPriceBandForProfitability}
              x2={theoreticalUpperPriceBandForProfitability}
            />
            <ReferenceDot
              x={ethPrice.toNumber()}
              y={getCrabReturnPercent(ethPrice.toNumber())}
              r={5}
              fill="#67FABF"
              strokeWidth={0}
            />
            <ReferenceDot
              x={lowerPriceBandForProfitability}
              y={getCrabReturnPercent(lowerPriceBandForProfitability)}
              r={3}
              fill="#000"
            />
            <ReferenceDot
              x={upperPriceBandForProfitability}
              y={getCrabReturnPercent(upperPriceBandForProfitability)}
              r={3}
              fill="#000"
            />
          </LineChart>
        </ResponsiveContainer>
      </Box>
    </>
  )
}

export default CrabProfitabilityChart

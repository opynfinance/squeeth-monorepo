import React from 'react'
import { useAtomValue } from 'jotai'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, ReferenceDot, ReferenceArea } from 'recharts'
import { Box, Typography } from '@material-ui/core'
import BigNumber from 'bignumber.js'

import { currentImpliedFundingAtom } from '@state/controller/atoms'
import { useSetProfitableMovePercentV2 } from '@state/crab/hooks'
import { ethPriceAtLastHedgeAtomV2 } from '@state/crab/atoms'
import { toTokenAmount } from '@utils/calculations'
import { useOnChainETHPrice } from '@hooks/useETHPrice'

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

const getDataPoints = (funding: number, ethPriceAtLastHedge: number) => {
  const dataPoints = []

  const starting = new BigNumber(-20)
  const increment = new BigNumber(0.1)
  const ending = new BigNumber(20)

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

const CrabProfitabilityChart: React.FC = () => {
  const currentImpliedFunding = useAtomValue(currentImpliedFundingAtom)
  const ethPriceAtLastHedgeValue = useAtomValue(ethPriceAtLastHedgeAtomV2)
  const profitableMovePercentV2 = useSetProfitableMovePercentV2()
  const ethPrice = useOnChainETHPrice()

  const ethPriceAtLastHedge = Number(toTokenAmount(ethPriceAtLastHedgeValue, 18))
  const lowerPriceBandForProfitability = ethPriceAtLastHedge - profitableMovePercentV2 * ethPriceAtLastHedge
  const upperPriceBandForProfitability = ethPriceAtLastHedge + profitableMovePercentV2 * ethPriceAtLastHedge

  const funding = 2 * currentImpliedFunding

  const theoreticalEthReturnForProfitability = Math.sqrt(funding)

  const theoreticalUpperPriceBandForProfitability =
    ethPriceAtLastHedge + theoreticalEthReturnForProfitability * ethPriceAtLastHedge
  const theoreticalLowerPriceBandForProfitability =
    ethPriceAtLastHedge - theoreticalEthReturnForProfitability * ethPriceAtLastHedge

  // generate data from -20% to 20%
  const data = getDataPoints(funding, ethPriceAtLastHedge)

  const getCrabReturnPercent = (ethPriceVal: number) => {
    const ethReturn = (ethPriceVal - ethPriceAtLastHedge) / ethPriceAtLastHedge
    return (funding - Math.pow(ethReturn, 2)) * 100
  }

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
      <Box height={300} width={500} marginTop="64px" display="flex" justifyContent="flex-start">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto-start-reverse">
              <polygon points="0 0, 10 5, 0 10" fill="#fff" opacity="0.5" />
            </marker>

            <XAxis
              type="number"
              dataKey="ethPrice"
              domain={['dataMin - 50', 'dataMax + 50']}
              tick={false}
              strokeDasharray="5,5"
              strokeOpacity="0.5"
              stroke="#fff"
              markerEnd="url(#arrowhead)"
            />
            <YAxis
              type="number"
              dataKey="crabReturn"
              tick={false}
              domain={['dataMin - 1', 'dataMax + 1']}
              strokeDasharray="5,5"
              strokeOpacity="0.5"
              stroke="#fff"
              markerStart="url(#arrowhead)"
              width={1}
            />

            <Line type="monotone" dataKey="crabReturnNegative" stroke="#FA7B67" dot={false} strokeWidth={1} />
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

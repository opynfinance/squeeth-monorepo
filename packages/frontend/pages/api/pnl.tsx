/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'
import React from 'react'
import { Duration, isFuture, intervalToDuration, format, isBefore } from 'date-fns'

import { SQUEETH_BASE_URL, CRABV2_START_DATE, BULL_START_DATE } from '@constants/index'

const OMDB_BASE_URL = process.env.NEXT_PUBLIC_OMDB_BASE_URL as string

export const config = {
  runtime: 'experimental-edge',
}

const formatDuration = (duration: Duration) => {
  const { years, months, days, hours } = duration
  const formattedDuration = []

  if (years) {
    formattedDuration.push(`${years}y`)
  }
  if (months) {
    formattedDuration.push(`${months}m`)
  }
  if (days) {
    formattedDuration.push(`${days}d`)
  }
  if (hours) {
    formattedDuration.push(`${hours}h`)
  }
  return formattedDuration.join(' ')
}

const CHART_WIDTH = 1000
const CHART_HEIGHT = 280

const X_AXIS_WIDTH = 5
const Y_AXIS_WIDTH = 5

const PADDING_X = 3
const PADDING_Y = 36

type StrategyType = 'crab' | 'zenbull'

interface UserPnlProps {
  strategy: StrategyType
  depositTimestamp: number
  pnl: number
  pnlData: number[][]
}

const UserPnl: React.FC<UserPnlProps> = ({ strategy, depositTimestamp, pnl, pnlData }) => {
  const date = new Date(depositTimestamp * 1000)
  const strategyDuration = intervalToDuration({ start: new Date(), end: date })
  const formattedDuration = formatDuration(strategyDuration)

  const pnlColor = pnl > 0 ? '#67fabf' : '#FA7B67'

  const xMax = Math.max(...pnlData.map(([x]) => x))
  const xMin = Math.min(...pnlData.map(([x]) => x))
  const yMax = Math.max(...pnlData.map(([, y]) => y))
  const yMin = Math.min(...pnlData.map(([, y]) => y))

  const yRange = yMax - yMin
  const xRange = xMax - xMin
  const offsetX = xMin
  const offsetY = yMin

  const chartXPadding = Y_AXIS_WIDTH + PADDING_X
  const chartYPadding = X_AXIS_WIDTH + PADDING_Y

  const availableChartWidth = CHART_WIDTH - 2 * chartXPadding
  const availableChartHeight = CHART_HEIGHT - 2 * chartYPadding

  // const points = pnlData
  //   .map(([x, y]) => {
  //     const pointX = chartXPadding + ((x - offsetX) / xRange) * availableChartWidth
  //     const pointY = CHART_HEIGHT - chartYPadding - ((y - offsetY) / yRange) * availableChartHeight

  //     return `${pointX},${pointY}`
  //   })
  //   .join(' ')

  // return (
  //   <div
  //     style={{
  //       backgroundColor: 'black',
  //       backgroundSize: '150px 150px',
  //       height: '100%',
  //       width: '100%',
  //       display: 'flex',
  //       textAlign: 'center',
  //       alignItems: 'center',
  //       justifyContent: 'center',
  //       flexDirection: 'column',
  //       flexWrap: 'nowrap',
  //     }}
  //   >
  //     <div
  //       style={{
  //         display: 'flex',
  //         alignItems: 'center',
  //         justifyContent: 'center',
  //         justifyItems: 'center',
  //       }}
  //     >
  //       <img
  //         alt="Vercel"
  //         height={200}
  //         src="data:image/svg+xml,%3Csvg width='116' height='100' fill='white' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M57.5 0L115 100H0L57.5 0z' /%3E%3C/svg%3E"
  //         style={{ margin: '0 30px' }}
  //         width={232}
  //       />
  //     </div>
  //     <div
  //       style={{
  //         fontSize: 60,
  //         fontStyle: 'normal',
  //         letterSpacing: '-0.025em',
  //         color: 'white',
  //         marginTop: 30,
  //         padding: '0 120px',
  //         lineHeight: 1.4,
  //         whiteSpace: 'pre-wrap',
  //       }}
  //     >
  //       {'squeeth is coool'}
  //     </div>
  //   </div>
  // )

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#191B1C',
        padding: '44px 100px',
      }}
    >
      <div tw="flex items-center justify-between w-full">
        <div tw="flex items-center">
          {/* <div tw="flex text-4xl">
            {strategy === 'crab' && (
              <img src={`${SQUEETH_BASE_URL}/images/crab-logo.png`} alt="opyn crab logo" height="32px" />
            )}
            {strategy === 'zenbull' && (
              <img src={`${SQUEETH_BASE_URL}/images/zenbull-logo.png`} alt="opyn zenbull logo" height="32px" />
            )}
          </div> */}
          <div tw="flex text-4xl text-white font-bold ml-4">
            {strategy === 'crab' && 'Crabber - Stacking USDC'}
            {strategy === 'zenbull' && 'Zen Bull - Stacking ETH'}
          </div>
        </div>
        {/* <div tw="flex text-2xl text-white text-opacity-60 ml-5">
          <img src={`${SQUEETH_BASE_URL}/images/logo.png`} alt="opyn logo" height="68px" />
        </div> */}
      </div>

      <div tw="flex flex-col mt-6">
        <div tw="flex text-xl text-white font-bold">
          {strategy === 'crab' && 'My Crab Position'}
          {strategy === 'zenbull' && 'My Zen Bull Position'}
        </div>
        <div tw="flex items-baseline mt-2">
          <div tw="flex text-4xl text-white font-bold" style={{ color: pnlColor }}>
            {pnl > 0 && '+'}
            {pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'}
          </div>

          <div tw="flex text-2xl text-white text-opacity-60 ml-4">
            {strategy === 'crab' && 'USD return'}
            {strategy === 'zenbull' && 'ETH return'}
          </div>
        </div>
      </div>

      {/* <div tw="flex mt-9">
        <div tw="flex absolute ml-5 text-white text-opacity-60 text-sm">
          {strategy === 'crab' && 'Crab Strategy'}
          {strategy === 'zenbull' && 'Zen Bull Strategy'}
        </div>

        <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="5" refY="5" orient="auto">
              <polygon points="0 0, 10 5, 0 10" fill="#fff" opacity="0.5" />
            </marker>
          </defs>

          <polyline fill="none" stroke="#70E3F6" strokeWidth="3" points={points} />
          <g>
            <line
              x1={Y_AXIS_WIDTH}
              x2={CHART_WIDTH - Y_AXIS_WIDTH}
              y1={CHART_HEIGHT - X_AXIS_WIDTH}
              y2={CHART_HEIGHT - X_AXIS_WIDTH}
              stroke="#fff"
              strokeOpacity="0.6"
              markerEnd="url(#arrowhead)"
              strokeDasharray="5,5"
            ></line>
          </g>
          <g>
            <line
              x1={Y_AXIS_WIDTH}
              x2={Y_AXIS_WIDTH}
              y1={CHART_HEIGHT - X_AXIS_WIDTH}
              y2={X_AXIS_WIDTH}
              stroke="#fff"
              strokeOpacity="0.6"
              markerEnd="url(#arrowhead)"
              strokeDasharray="5,5"
            ></line>
          </g>
        </svg>
      </div> */}

      {/* <div tw="flex text-white text-opacity-60 mt-2">
        {format(date, 'MM/dd/yy')} (deposited {formattedDuration} ago)
      </div> */}
    </div>
  )
}

const font = fetch(new URL('../../public/fonts/DMSans-Regular.ttf', import.meta.url).toString()).then((res) =>
  res.arrayBuffer(),
)
const fontMedium = fetch(new URL('../../public/fonts/DMSans-Medium.ttf', import.meta.url).toString()).then((res) =>
  res.arrayBuffer(),
)

const fetchPnlData = async (strategy: StrategyType, startTimestamp: number, endTimestamp: number) => {
  console.log('fetching pnl data', strategy, startTimestamp, endTimestamp)

  if (strategy === 'crab') {
    const response = await fetch(
      `${OMDB_BASE_URL}/metrics/crabv2?start_timestamp=${startTimestamp}&end_timestamp=${endTimestamp}`,
    ).then((res) => res.json())
    console.log('response: crab', response)

    return response.data.map((x: Record<string, number>) => [x.timestamp * 1000, x.crabPnL * 100])
  } else if (strategy === 'zenbull') {
    const response = await fetch(`${OMDB_BASE_URL}/metrics/zenbull/pnl/${startTimestamp}/${endTimestamp}`).then((res) =>
      res.json(),
    )
    console.log('response: zenbull', response)

    return response.data.map((x: Record<string, number>) => [x.timestamp * 1000, x.bullEthPnl])
  }

  throw new Error('Invalid strategy')
}

export default async function handler(req: NextRequest) {
  try {
    // const [fontData, fontMediumData] = await Promise.all([font, fontMedium])

    const { searchParams } = new URL(req.url)
    const strategy = searchParams.get('strategy') as StrategyType
    const depositedAt = searchParams.get('depositedAt')
    const pnl = searchParams.get('pnl')
    console.log('query params', strategy, depositedAt, pnl)

    if (!strategy || !depositedAt || !pnl) {
      return new Response(`Missing "strategy", "depositedAt" or "pnl" query param`, {
        status: 400,
      })
    }

    const depositDate = new Date(Number(depositedAt) * 1000)
    if (isFuture(depositDate)) {
      return new Response(`Deposit date is in future`, {
        status: 400,
      })
    }

    const crabV2LaunchDate = new Date(CRABV2_START_DATE)
    const zenBullLaunchDate = new Date(BULL_START_DATE)

    let startDate = depositDate
    if (strategy === 'crab' && isBefore(depositDate, crabV2LaunchDate)) {
      startDate = crabV2LaunchDate
    } else if (strategy === 'zenbull' && isBefore(depositDate, zenBullLaunchDate)) {
      startDate = zenBullLaunchDate
    }

    const startTimestamp = startDate.getTime() / 1000
    const endTimestamp = Math.round(new Date().getTime() / 1000)
    // const pnlData = await fetchPnlData(strategy, startTimestamp, endTimestamp)
    const pnlData = [[0, 0]]

    return new ImageResponse(
      <UserPnl strategy={strategy} depositTimestamp={startTimestamp} pnl={Number(pnl)} pnlData={pnlData} />,

      {
        width: 1200,
        height: 630,
        // fonts: [
        //   {
        //     name: 'DMSans',
        //     data: fontData,
        //     style: 'normal',
        //     weight: 400,
        //   },
        //   {
        //     name: 'DMSans',
        //     data: fontMediumData,
        //     style: 'normal',
        //     weight: 500,
        //   },
        // ],
        // emoji: 'noto',
      },
    )
  } catch (e: any) {
    console.log(`${e.message}`)
    return new Response(`Failed to generate the image`, {
      status: 500,
    })
  }
}

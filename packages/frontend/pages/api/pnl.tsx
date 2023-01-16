import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'
import React from 'react'
import { Duration, isFuture, intervalToDuration, format } from 'date-fns'

const omdbBaseUrl = process.env.NEXT_PUBLIC_OMDB_BASE_URL as string

export const config = {
  runtime: 'experimental-edge',
}

type PnLDataPoint = [number, number]

interface UIProps {
  depositTimestamp: number
  pnl: number
  pnlData: PnLDataPoint[]
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
    formattedDuration.push(`and ${hours}h`)
  }

  return formattedDuration.join(' ')
}

const CHART_WIDTH = 1000
const CHART_HEIGHT = 280

const X_AXIS_WIDTH = 5
const Y_AXIS_WIDTH = 5

const PADDING_X = 4
const PADDING_Y = 36

const UI: React.FC<UIProps> = ({ depositTimestamp, pnl, pnlData }) => {
  const date = new Date(depositTimestamp * 1000)
  const strategyDuration = intervalToDuration({ start: new Date(), end: date })
  const formattedDuration = formatDuration(strategyDuration)

  const pnlColor = pnl > 0 ? '#49D273' : '#EC7987'

  const xMax = Math.max(...pnlData.map(([x]) => x))
  const xMin = Math.min(...pnlData.map(([x]) => x))
  const yMax = Math.max(...pnlData.map(([, y]) => y))
  const yMin = Math.min(...pnlData.map(([, y]) => y))

  const yRange = yMax - yMin
  const xRange = xMax - xMin
  const offsetX = xMin
  const offsetY = yMin

  const points = pnlData
    .map(
      ([x, y]) =>
        `${Y_AXIS_WIDTH + PADDING_X + ((x - offsetX) / xRange) * (CHART_WIDTH - (Y_AXIS_WIDTH + PADDING_X))},${
          CHART_HEIGHT -
          (X_AXIS_WIDTH + PADDING_Y) -
          ((y - offsetY) / yRange) * (CHART_HEIGHT - 2 * (X_AXIS_WIDTH + PADDING_Y))
        }`,
    )
    .join(' ')

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#191B1C',
        padding: '35px 100px',
      }}
    >
      <div tw="flex items-center justify-between w-full">
        <div tw="flex items-baseline">
          <div tw="flex text-4xl">🦀</div>
          <div tw="flex text-4xl text-white font-bold ml-4">Crabber - Stacking USDC</div>
        </div>
        <div tw="flex text-2xl text-white text-opacity-60 ml-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://continuouscall-git-share-pnl-with-og-opynfinance.vercel.app/images/logo.png"
            alt="opyn logo"
            height="72px"
          />
        </div>
      </div>

      <div tw="flex flex-col mt-6">
        <div tw="flex text-xl text-white font-bold">My Crab Position</div>
        <div tw="flex items-baseline mt-2">
          <div tw="flex text-4xl text-white font-bold" style={{ color: pnlColor }}>
            {pnl > 0 && '+'}
            {pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'}
          </div>

          <div tw="flex text-2xl text-white text-opacity-60 ml-4">USD return</div>
        </div>
      </div>

      <div tw="flex mt-9">
        <div tw="flex absolute ml-4 text-white text-opacity-60  text-sm">Crab Strategy</div>

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
            {/* y-axis */}
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
      </div>

      <div tw="flex text-white text-opacity-60 mt-2">
        {format(date, 'MM/dd/yy')} (since {formattedDuration})
      </div>
    </div>
  )
}

const font = fetch(new URL('../../public/fonts/DMSans-Regular.ttf', import.meta.url).toString()).then((res) =>
  res.arrayBuffer(),
)
const fontMedium = fetch(new URL('../../public/fonts/DMSans-Medium.ttf', import.meta.url).toString()).then((res) =>
  res.arrayBuffer(),
)

export default async function handler(req: NextRequest) {
  try {
    const [fontData, fontMediumData] = await Promise.all([font, fontMedium])

    const { searchParams } = new URL(req.url)

    const depositTimestamp = searchParams.get('depositedAt')
    const pnl = searchParams.get('pnl')
    if (!depositTimestamp || !pnl) {
      return new Response(`Missing "depositTimestamp" or "pnl" query param`, {
        status: 400,
      })
    }

    const depositDate = new Date(Number(depositTimestamp) * 1000)
    if (isFuture(depositDate)) {
      return new Response(`Deposit date is in future`, {
        status: 400,
      })
    }

    const startTimestamp = Number(depositTimestamp)
    const endTimestamp = Math.round(new Date().getTime() / 1000)

    const response = await fetch(
      `${omdbBaseUrl}/metrics/crabv2?start_timestamp=${startTimestamp}&end_timestamp=${endTimestamp}`,
    ).then((res) => res.json())
    const pnlData = response.data.map((x: Record<string, number>) => [x.timestamp * 1000, x.crabPnL * 100])

    return new ImageResponse(<UI depositTimestamp={Number(depositTimestamp)} pnl={Number(pnl)} pnlData={pnlData} />, {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: 'DMSans',
          data: fontData,
          style: 'normal',
          weight: 400,
        },
        {
          name: 'DMSans',
          data: fontMediumData,
          style: 'normal',
          weight: 500,
        },
      ],
      emoji: 'noto',
    })
  } catch (e: any) {
    console.log(`${e.message}`)
    return new Response(`Failed to generate the image`, {
      status: 500,
    })
  }
}

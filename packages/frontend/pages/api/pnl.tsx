import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'
import React from 'react'
import { Duration, isFuture, intervalToDuration } from 'date-fns'

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
    .map(([x, y]) => `${((x - offsetX) / xRange) * 1000},${200 - ((y - offsetY) / yRange) * 200}`)
    .join(' ')

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#191B1C',
        padding: '50px 100px',
      }}
    >
      <div tw="flex items-baseline">
        <div tw="flex text-4xl">🦀</div>
        <div tw="flex text-4xl text-white font-bold ml-4">Crabber - Stacking USDC</div>
        <div tw="flex text-2xl text-gray-400 ml-5">Powered by Opyn</div>
      </div>

      <div tw="flex flex-col mt-10">
        <div tw="flex text-xl text-white">My Crab Position</div>
        <div tw="flex items-baseline mt-2">
          <div tw="flex text-4xl text-white font-bold" style={{ color: pnlColor }}>
            {pnl > 0 && '+'}
            {pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%'}
          </div>

          <div tw="flex text-2xl text-gray-400 ml-5">USD return</div>
        </div>
      </div>

      <div tw="flex flex-col mt-10">
        <div tw="flex text-2xl text-white">In Crab since</div>
        <div tw="flex text-2xl text-white font-bold mt-2">{formattedDuration}</div>
      </div>

      <div tw="flex mt-10">
        <svg viewBox="0 0 1000 200">
          <polyline fill="none" stroke="#0074d9" strokeWidth="3" points={points} />
        </svg>
      </div>
    </div>
  )
}

const font = fetch(new URL('../../public/fonts/DMMono-Regular.ttf', import.meta.url).toString()).then((res) =>
  res.arrayBuffer(),
)
const fontMedium = fetch(new URL('../../public/fonts/DMMono-Medium.ttf', import.meta.url).toString()).then((res) =>
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
          name: 'DMMono',
          data: fontData,
          style: 'normal',
          weight: 400,
        },
        {
          name: 'DMMono',
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

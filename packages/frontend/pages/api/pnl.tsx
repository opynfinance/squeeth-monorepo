import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'
import React from 'react'
import intervalToDuration from 'date-fns/intervalToDuration'
import formatDuration from 'date-fns/formatDuration'

export const config = {
  runtime: 'experimental-edge',
}

const UI: React.FC<{ depositTimestamp: number }> = ({ depositTimestamp }) => {
  const date = new Date(depositTimestamp)
  const strategyDuration = intervalToDuration({ start: new Date(), end: date })
  const formattedDuration = formatDuration(strategyDuration, {
    format: ['days', 'hours'],
    delimiter: ' & ',
  })

  const pnl = 2.5
  const pnlColor = pnl > 0 ? '#49D273' : '#EC7987'

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
      </div>

      <div tw="flex flex-col mt-10">
        <div tw="flex text-2xl text-white">My Crab Position</div>
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
    if (!depositTimestamp) {
      return new Response(`Missing "depositTimestamp" query param`, {
        status: 400,
      })
    }

    return new ImageResponse(<UI depositTimestamp={Number(depositTimestamp)} />, {
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

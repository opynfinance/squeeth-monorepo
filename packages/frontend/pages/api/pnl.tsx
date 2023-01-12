import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'
import Image from 'next/image'
import React from 'react'

import { getCrabPnlV2ChartData } from '@utils/pricer'
import logo from '../../public/images/logo.svg'

export const config = {
  runtime: 'experimental-edge',
}

// default timestamp = 1672901127170

const UI: React.FC<{ depositTimestamp: number }> = ({ depositTimestamp }) => {
  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#191B1C',
        padding: '50px 200px',
      }}
    >
      <div tw="flex text-4xl text-white font-bold">Crabber - Stacking USDC</div>

      <img
        alt="logo"
        width="256"
        src={'https://squeeth.opyn.co/images/logo.svg'}
        style={{
          borderRadius: 128,
        }}
      />

      <div tw="flex text-4xl text-white font-regular">{depositTimestamp}</div>
    </div>
  )
}

export default async function handler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    const depositTimestamp = searchParams.get('depositTimestamp')
    if (!depositTimestamp) {
      return new Response(`Missing "depositTimestamp" query param`, {
        status: 400,
      })
    }

    const depositDate = new Date(depositTimestamp)
    const today = new Date()

    const data = await getCrabPnlV2ChartData(
      Number(depositDate.valueOf().toString().slice(0, -3)),
      Number(today.valueOf().toString().slice(0, -3)),
    )

    console.log({ data })

    return new ImageResponse(<UI depositTimestamp={Number(depositTimestamp)} />, {
      width: 1200,
      height: 630,
      emoji: 'twemoji',
    })
  } catch (e: any) {
    console.log(`${e.message}`)
    return new Response(`Failed to generate the image`, {
      status: 500,
    })
  }
}

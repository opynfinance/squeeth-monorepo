import { ImageResponse } from '@vercel/og'
import { NextRequest } from 'next/server'
import Image from 'next/image'
import React from 'react'
import { Box, Typography } from '@material-ui/core'
import { makeStyles, createStyles } from '@material-ui/core/styles'

import Emoji from '@components/Emoji'

export const config = {
  runtime: 'experimental-edge',
}

const useStyles = makeStyles((theme) => createStyles({}))

// default timestamp = 1672901127170

const UI: React.FC<{ depositTimestamp: number }> = ({ depositTimestamp }) => {
  const classes = useStyles()

  return (
    <div>
      <Box display="flex" justifyContent="space-between">
        <Box display="flex" gridGap="12px"></Box>
      </Box>
    </div>
  )
}

export default function handler(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const hasTimestamp = searchParams.has('depositTimestamp')
    if (!hasTimestamp) {
      return new Response(`Missing "depositTimestamp" query param`, {
        status: 400,
      })
    }

    const depositTimestamp = searchParams.get('depositTimestamp')

    return new ImageResponse(<UI depositTimestamp={Number(depositTimestamp)} />, {
      width: 1200,
      height: 630,
    })
  } catch (e: any) {
    console.log(`${e.message}`)
    return new Response(`Failed to generate the image`, {
      status: 500,
    })
  }
}

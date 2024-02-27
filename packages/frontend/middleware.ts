import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

import { isVPN } from 'src/server/ipqs'
import { BLOCKED_IP_VALUE } from 'src/constants'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000

interface RedisResponse {
  value: string
  timestamp: number
}

async function isIPBlockedInRedis(ip: string, currentTime: number) {
  let redisData: RedisResponse | null = null
  try {
    redisData = await redis.get<RedisResponse>(ip)
  } catch (error) {
    console.error('Failed to get data from Redis:', error)
  }

  let isIPBlocked = false
  if (redisData) {
    try {
      const { value, timestamp } = redisData
      // check if entry is valid and is not more than 30 days old
      if (value === BLOCKED_IP_VALUE && currentTime - timestamp <= THIRTY_DAYS_IN_MS) {
        isIPBlocked = true
      }
    } catch (error) {
      console.error('Failed to parse data from Redis:', error)
    }
  }

  return isIPBlocked
}

export async function middleware(request: NextRequest) {
  const cloudflareCountry = request.headers.get('cf-ipcountry')
  const country = cloudflareCountry ?? request.geo?.country
  const url = request.nextUrl

  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || request.ip

  const allowedIPs = (process.env.WHITELISTED_IPS || '').split(',')
  const isIPWhitelisted = ip && allowedIPs.includes(ip)

  if (ip && !isIPWhitelisted) {
    const currentTime = Date.now()
    // check if IP is blocked
    const isIPBlocked = await isIPBlockedInRedis(ip, currentTime)
    if (isIPBlocked && url.pathname !== '/blocked') {
      return NextResponse.redirect(`${url.protocol}//${url.host}/blocked`)
    }

    // check if IP is from VPN
    const isIPFromVPN = await isVPN(ip)
    if (isIPFromVPN && url.pathname !== '/blocked') {
      try {
        await redis.set(ip, { value: BLOCKED_IP_VALUE, timestamp: currentTime })
      } catch (error) {
        console.error('Failed to set data in Redis:', error)
      }
      return NextResponse.redirect(`${url.protocol}//${url.host}/blocked`)
    }
  }

  if (url.searchParams.has('ct') && url.searchParams.get('ct') === String(country)) {
    return NextResponse.next()
  }

  url.searchParams.set('ct', country!)
  return NextResponse.redirect(url)
}

/*
  matcher for excluding public assets/api routes/_next
  link: https://github.com/vercel/next.js/discussions/36308#discussioncomment-3758041
*/
export const config = {
  matcher: '/((?!api|static|.*\\..*|_next|blocked).*)',
}

import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

import { isVPN } from 'src/server/ipqs'
import { BLOCKED_IP_VALUE } from 'src/constants'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function middleware(request: NextRequest) {
  const cloudflareCountry = request.headers.get('cf-ipcountry')
  const country = cloudflareCountry ?? request.geo?.country
  const url = request.nextUrl

  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || request.ip

  const allowedIPs = (process.env.WHITELISTED_IPS || '').split(',')
  console.log({ allowedIPs })
  const isIPWhitelisted = ip && allowedIPs.includes(ip)

  if (ip && !isIPWhitelisted) {
    let redisData
    try {
      redisData = await redis.get(ip)
    } catch (error) {
      console.error('Failed to get data from Redis:', error)
    }

    const isIPBlocked = redisData === BLOCKED_IP_VALUE
    console.log('ip', ip, isIPBlocked, url.protocol, url.host, '/blocked')
    if (isIPBlocked && url.pathname !== '/blocked') {
      return NextResponse.redirect(`${url.protocol}//${url.host}/blocked`)
    }

    const isFromVpn = await isVPN(ip)
    if (isFromVpn && url.pathname !== '/blocked') {
      try {
        await redis.set(ip, BLOCKED_IP_VALUE)
      } catch (error) {
        console.error('Failed to set data in Redis:', error)
      }
      console.log('vpnip', ip, isFromVpn, '/blocked')
      return NextResponse.redirect(`${url.protocol}//${url.host}/blocked`)
    }
  }

  console.log('country', cloudflareCountry, country)

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

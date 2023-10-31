import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { isVPN } from 'src/server/ipqs'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

const IS_VPN = 1
const IS_NOT_VPN = 2

export async function middleware(request: NextRequest) {
  const cloudflareCountry = request.headers.get('cf-ipcountry')
  const country = cloudflareCountry ?? request.geo?.country
  const url = request.nextUrl

  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || request.ip

  const allowedIPs = (process.env.WHITELISTED_IPS || '').split(',')
  const isIPWhitelisted = ip && allowedIPs.includes(ip)

  if (ip && !isIPWhitelisted) {
    const redisData = await redis.get(ip)
    console.log('ip', ip, redisData, url.protocol, url.host, '/blocked')

    if (redisData == IS_VPN) {
      // IP is blocked, redirect
      if (url.pathname !== '/blocked') {
        return NextResponse.redirect(`${url.protocol}//${url.host}/blocked`)
      }
    } else if (redisData == null) {
      // check vpn from ipqs if redisData does not exist
      console.log('calling ipqs')
      const isFromVpn = await isVPN(ip)
      console.log('vpnip', ip, isFromVpn)
      if (isFromVpn) {
        await redis.set(ip, IS_VPN) // 1 means vpn
        if (url.pathname !== '/blocked') {
          return NextResponse.redirect(`${url.protocol}//${url.host}/blocked`)
        }
      } else {
        await redis.set(ip, IS_NOT_VPN) // 2 means checked and is not VPN
      }
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

import { NextRequest, NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { isVPN } from 'src/server/ipqs'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})

export async function middleware(request: NextRequest) {
  const cloudflareCountry = request.headers.get('cf-ipcountry')
  const country = cloudflareCountry ?? request.geo?.country
  const url = request.nextUrl

  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || request.ip
  const user_agent = request.headers.get('user-agent')
  const language = request.headers.get('accept-language')

  const allowedIPs = (process.env.WHITELISTED_IPS || '').split(',')
  const isIPWhitelisted = ip && allowedIPs.includes(ip)

  if (ip && !isIPWhitelisted) {
    const redisData = await redis.get(ip)
    const isIPBlocked = !!redisData

    console.log('ip', ip, isIPBlocked, url.protocol, url.host, '/blocked')

    if (isIPBlocked && url.pathname !== '/blocked') {
      return NextResponse.redirect(`${url.protocol}//${url.host}/blocked`)
    }

    const isFromVpn = await isVPN(ip, user_agent ?? '', language ?? '')
    if (isFromVpn && url.pathname !== '/blocked') {
      await redis.set(ip, 1)
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

import { NextRequest, NextResponse } from 'next/server'

const BLOCKED_COUNTRIES = ['US', 'BY', 'CU', 'IR', 'IQ', 'CI', 'LR', 'KP', 'SD', 'SY', 'ZW']

export default function middleware(request: NextRequest) {
  const country = request.geo?.country
  const url = request.nextUrl
  const isRestricted = BLOCKED_COUNTRIES.includes(country ?? '')

  if (request.cookies.opyn_geo && request.cookies.opyn_geo === 'false') {
    if (!isRestricted) {
      return NextResponse.rewrite(url)
    } else {
      return NextResponse.redirect(url).clearCookie('opyn_geo')
    }
  }

  if (url.searchParams.has('country') && url.searchParams.get('country') === String(country)) {
    return NextResponse.next()
  }

  if (!request.cookies.opyn_geo) {
    url.searchParams.set('country', country!)
    url.searchParams.set('restricted', String(isRestricted))
  }

  return NextResponse.redirect(url)
}

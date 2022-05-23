import { NextRequest, NextResponse } from 'next/server'

// const BLOCKED_COUNTRIES = ['US', 'BY', 'CU', 'IR', 'IQ', 'CI', 'LR', 'KP', 'SD', 'SY', 'ZW']

export default function middleware(request: NextRequest) {
  const country = request.geo?.country
  const url = request.nextUrl
  // const isRestricted = BLOCKED_COUNTRIES.includes(country ?? '')

  if (request.cookies.opyn_geo) {
    const cachedCountry = request.cookies.opyn_geo.split(',')[1]
    if (cachedCountry !== String(country)) {
      return NextResponse.redirect(url).clearCookie('opyn_geo')
    } else {
      return NextResponse.next()
    }
  }

  if (url.searchParams.has('country') && url.searchParams.get('country') === String(country)) {
    return NextResponse.next()
  }

  url.searchParams.set('country', country!)
  // url.searchParams.set('restricted', String(isRestricted))

  return NextResponse.redirect(url)
}

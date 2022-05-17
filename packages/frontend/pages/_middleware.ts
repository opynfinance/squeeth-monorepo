import { NextRequest, NextResponse } from 'next/server'

const BLOCKED_COUNTRIES = ['US', 'BY', 'CU', 'IR', 'IQ', 'CI', 'LR', 'KP', 'SD', 'SY', 'ZW']

export default function middleware(request: NextRequest) {
  const country = request.geo?.country
  const url = request.nextUrl

  if (url.searchParams.has('country')) {
    return NextResponse.next()
  }

  const isRestricted = BLOCKED_COUNTRIES.includes(country ?? '')

  url.searchParams.set('country', country!)
  url.searchParams.set('restricted', String(isRestricted))

  return NextResponse.redirect(url)
}

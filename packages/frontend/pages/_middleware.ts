import { NextRequest, NextResponse } from 'next/server'

const BLOCKED_COUNTRIES = ['US', 'BY', 'CU', 'IR', 'IQ', 'CI', 'LR', 'KP', 'SD', 'SY', 'ZW']

export default function middleware(request: NextRequest) {
  const country = request.geo?.country

  const cookieFromRequest = request.cookies['restriction']

  if (country && BLOCKED_COUNTRIES.includes(country) && !cookieFromRequest) {
    return NextResponse.rewrite('/country-not-supported')
  }

  return NextResponse.rewrite(request.nextUrl)
}

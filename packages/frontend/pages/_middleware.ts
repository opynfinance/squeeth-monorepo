import { NextRequest, NextResponse } from 'next/server'

const BLOCKED_COUNTRIES = ['US', 'BY', 'CU', 'IR', 'IQ', 'CI', 'LR', 'KP', 'SD', 'SY', 'ZW']

export default function middleware(request: NextRequest) {
  const country = request.geo?.country
  request.nextUrl.searchParams.set('country', 'Nigeria')
  request.nextUrl.searchParams.set('restricted', 'false')

  const response = NextResponse.redirect(request.nextUrl)

  if (country && BLOCKED_COUNTRIES.includes(country)) {
    response.cookie('restricted', `true,${country}`)
  } else {
    response.cookie('restricted', 'false')
  }

  return response
}

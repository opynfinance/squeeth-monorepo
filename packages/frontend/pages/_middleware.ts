import { NextRequest, NextResponse } from 'next/server'

const BLOCKED_COUNTRIES = ['US', 'BY', 'CU', 'IR', 'IQ', 'CI', 'LR', 'KP', 'SD', 'SY', 'ZW']

export default function middleware(request: NextRequest) {
  const country = request.geo?.country

  const response = NextResponse.next()

  if (country && BLOCKED_COUNTRIES.includes(country)) {
    response.cookie('restricted', 'true')
  } else {
    response.cookie('restricted', 'false')
  }

  return response
}

import { NextRequest, NextResponse } from 'next/server'

const BLOCKED_COUNTRIES = ['US', 'BY', 'CU', 'IR', 'IQ', 'CI', 'LR', 'KP', 'SD', 'SY', 'ZW']

export default function middleware(request: NextRequest) {
  const country = request.geo?.country
  const url = request.url + `?country=${country}`

  const response = NextResponse.rewrite(url)

  if (country && BLOCKED_COUNTRIES.includes(country)) {
    response.cookie('restricted', `true,${country}`)
  } else {
    response.cookie('restricted', 'false')
  }

  return response
}

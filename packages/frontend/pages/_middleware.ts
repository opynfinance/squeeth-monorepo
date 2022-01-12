import { NextRequest, NextResponse } from 'next/server'

const BLOCKED_COUNTRIES = ['US', 'BY', 'CU', 'IR', 'IQ', 'CI', 'LR', 'KP', 'SD', 'SY', 'ZW']

export default function middleware(request: NextRequest) {
  const country = request.geo?.country

  console.log(request.headers, 'HEADERS')
  console.log(request.referrer, 'REFERRER')
  console.log(request.url, 'URL')
  console.log({ request })

  if (country && BLOCKED_COUNTRIES.includes(country)) {
    return NextResponse.rewrite('/country-not-supported')
  }

  return NextResponse.next()
}

import { NextRequest, NextResponse } from 'next/server'

const BLOCKED_COUNTRIES = ['US', 'BY', 'CU', 'IR', 'IQ', 'CI', 'LR', 'KP', 'SD', 'SY', 'ZW']

export default function middleware(request: NextRequest) {
  const country = request.geo?.country
  const url = request.nextUrl

  url.searchParams.set('country', country!)
  url.searchParams.set('restricted', 'false')
  let redirect = false

  if (url.searchParams.get('country') && !redirect) {
    redirect = true
    return NextResponse.redirect(request.nextUrl)
  } else {
    return NextResponse.next()
  }

  // if (country && BLOCKED_COUNTRIES.includes(country)) {
  //   response.cookie('restricted', `true,${country}`)
  // } else {
  //   response.cookie('restricted', 'false')
  // }

  // return response
}

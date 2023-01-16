import { NextRequest, NextResponse } from 'next/server'

export default function middleware(request: NextRequest) {
  const cloudfareCountry = request.headers.get('cf-ipcountry')
  const country = cloudfareCountry ?? request.geo?.country
  const url = request.nextUrl

  console.log('country', cloudfareCountry, country)

  if (url.searchParams.has('ct') && url.searchParams.get('ct') === String(country)) {
    return NextResponse.next()
  }

  url.searchParams.set('ct', country!)

  return NextResponse.redirect(url)
}

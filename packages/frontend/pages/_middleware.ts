import { NextRequest, NextResponse } from 'next/server'

export default function middleware(request: NextRequest) {
  const country = request.geo?.country
  const url = request.nextUrl

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

  return NextResponse.redirect(url)
}

import { NextRequest, NextResponse } from 'next/server'

export default function middleware(request: NextRequest) {
  const country = request.geo?.country
  const url = request.nextUrl

  if (url.searchParams.has('country') && url.searchParams.get('country') === String(country)) {
    return NextResponse.next()
  }

  url.searchParams.set('country', country!)

  return NextResponse.redirect(url)
}

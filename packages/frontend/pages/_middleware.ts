import { NextRequest, NextResponse } from 'next/server'

export default function middleware(request: NextRequest) {
  const country = request.geo?.country
  const url = request.nextUrl

  if (url.searchParams.has('ct') && url.searchParams.get('ct') === String(country)) {
    return NextResponse.next()
  }

  url.searchParams.set('ct', country!)

  return NextResponse.redirect(url)
}

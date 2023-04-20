import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const cloudfareCountry = request.headers.get('cf-ipcountry') || 'US'
  const country = cloudfareCountry ?? request.geo?.country
  const url = request.nextUrl

  console.log('country', cloudfareCountry, country)

  if (url.searchParams.has('ct') && url.searchParams.get('ct') === String(country)) {
    return NextResponse.next()
  }

  url.searchParams.set('ct', country!)
  return NextResponse.redirect(url)
}

/*
  matcher for excluding public assets/api routes/_next
  link: https://github.com/vercel/next.js/discussions/36308#discussioncomment-3758041
*/
export const config = {
  matcher: '/((?!api|static|.*\\..*|_next).*)',
}

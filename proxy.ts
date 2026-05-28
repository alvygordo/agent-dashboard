import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = [
  '/login',
  '/api/auth/salesforce',
  '/api/auth/callback/salesforce',
  '/_next/',
  '/favicon.ico',
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const isDev = process.env.NODE_ENV === 'development'
  const user = request.cookies.get('agent_dashboard_user')?.value
  if (!isDev && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}

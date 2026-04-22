import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from './app/api/auth/session'

const PUBLIC = ['/login', '/api/auth', '/_next', '/favicon']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next()

  const cookie = req.cookies.get(SESSION_COOKIE)?.value

  // Fast-path: cookie present — allow through (API routes verify properly)
  if (cookie) return NextResponse.next()

  // No cookie — check if auth is actually enabled before redirecting
  try {
    const res = await fetch(new URL('/api/auth', req.url).toString(), {
      headers: { cookie: req.headers.get('cookie') ?? '' },
      cache: 'no-store',
    })
    const data = (await res.json()) as { enabled: boolean }
    if (!data.enabled) return NextResponse.next()
  } catch {
    return NextResponse.next() // fail-open: never lock users out on errors
  }

  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const SESSION_COOKIE = 'og_session'
// Routes that never need auth or onboarding checks
const PUBLIC = ['/login', '/api/auth', '/_next', '/favicon']
// Routes that need auth but skip the onboarding redirect
const SKIP_ONBOARDING_CHECK = ['/onboarding', '/api/onboarding-proxy']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next()

  const cookie = req.cookies.get(SESSION_COOKIE)?.value

  // No cookie — check if auth is actually enabled before redirecting
  if (!cookie) {
    try {
      const res = await fetch(new URL('/api/auth', req.url).toString(), {
        headers: { cookie: req.headers.get('cookie') ?? '' },
        cache: 'no-store',
      })
      const data = (await res.json()) as { enabled: boolean }
      if (data.enabled) {
        const url = req.nextUrl.clone()
        url.pathname = '/login'
        url.searchParams.set('next', pathname)
        return NextResponse.redirect(url)
      }
    } catch {
      return NextResponse.next() // fail-open: never lock users out on errors
    }
  }

  // Authenticated — check onboarding (skip for onboarding page itself + API routes)
  if (SKIP_ONBOARDING_CHECK.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Only redirect to onboarding for the main app pages, not API routes
  if (!pathname.startsWith('/api/') && pathname !== '/onboarding') {
    try {
      const res = await fetch(new URL('/api/onboarding-proxy', req.url).toString(), {
        headers: { cookie: req.headers.get('cookie') ?? '' },
        cache: 'no-store',
      })
      const data = (await res.json()) as { complete: boolean }
      if (!data.complete) {
        const url = req.nextUrl.clone()
        url.pathname = '/onboarding'
        return NextResponse.redirect(url)
      }
    } catch {
      // fail-open: don't block if onboarding check fails
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

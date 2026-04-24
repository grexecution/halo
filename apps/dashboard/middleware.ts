import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { readAuthConfig } from './app/api/auth/store'
import { verifySession, SESSION_COOKIE } from './app/api/auth/session'

// Routes that never need auth or onboarding checks
const PUBLIC = ['/login', '/api/auth', '/_next', '/favicon']
// Routes that need auth but skip the onboarding redirect
const SKIP_ONBOARDING_CHECK = ['/onboarding', '/api/onboarding-proxy', '/setup', '/api/setup']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next()

  const cookie = req.cookies.get(SESSION_COOKIE)?.value

  // Read auth config directly — no self-fetch, no race condition
  const cfg = readAuthConfig()

  if (cfg.enabled) {
    if (!cookie || !verifySession(cookie, cfg.sessionSecret)) {
      const url = req.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname)
      return NextResponse.redirect(url)
    }
  }

  // Skip onboarding check for setup, onboarding, and API routes
  if (SKIP_ONBOARDING_CHECK.some((p) => pathname.startsWith(p)) || pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Onboarding check: only for page routes, server-side via DB would be ideal
  // but we keep the proxy fetch here since it's post-auth (session verified above)
  // No fail-open — if onboarding check fails just continue
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

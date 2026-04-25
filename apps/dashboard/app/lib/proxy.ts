/**
 * Shared helpers for dashboard API proxy routes.
 *
 * Every route that proxies requests to the control-plane should use
 * `proxyFetch` instead of duplicating fetch + error handling boilerplate.
 */

import { NextResponse } from 'next/server'

/** Default timeout for proxy calls — 10s for most routes, 300s for chat. */
const DEFAULT_TIMEOUT_MS = 10_000

/**
 * Proxy a request to the control-plane and return a NextResponse.
 * Handles JSON parse, status forwarding, and 502 on network error.
 */
export async function proxyFetch(
  url: string,
  opts?: RequestInit & { timeoutMs?: number },
): Promise<NextResponse> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOpts } = opts ?? {}
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      ...fetchOpts,
    })
    const data = (await res.json()) as unknown
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}

/**
 * Build a standard 500 error response from a caught exception.
 * Use in routes that handle their own logic (not pure proxies).
 */
export function handleApiError(err: unknown, status = 500): NextResponse {
  const message = err instanceof Error ? err.message : String(err)
  return NextResponse.json({ error: message }, { status })
}

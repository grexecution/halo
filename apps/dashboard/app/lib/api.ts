import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

type Handler = (req: NextRequest, ctx: unknown) => Promise<NextResponse>

/**
 * Wraps a route handler with standard error handling.
 * Eliminates the try/catch boilerplate that appears in every route file.
 */
export function withErrorHandler(fn: Handler): Handler {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return NextResponse.json({ error: message }, { status: 500 })
    }
  }
}

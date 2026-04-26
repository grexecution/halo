export const dynamic = 'force-dynamic'
/**
 * GET /api/memories
 * Proxies to control-plane /api/memory/browse — returns lifetime Postgres memories.
 * Falls back to an empty result if control-plane is unavailable (e.g. DATABASE_URL not set).
 *
 * Query: q=..., source=..., cursor=ISO-timestamp, limit=N
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { CONTROL_PLANE_URL } from '../../lib/env'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const upstream = new URL(`${CONTROL_PLANE_URL}/api/memory/browse`)
  for (const [k, v] of searchParams.entries()) {
    upstream.searchParams.set(k, v)
  }

  try {
    const res = await fetch(upstream.toString(), {
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: `Control-plane error: ${text}` }, { status: res.status })
    }
    const data = (await res.json()) as {
      results: unknown[]
      total: number
      bySource: Record<string, number>
      nextCursor: string | null
    }
    // Normalise to match the shape the Memory tab expects
    return NextResponse.json({
      results: data.results,
      total: data.total,
      stats: { bySource: data.bySource ?? {} },
      nextCursor: data.nextCursor ?? null,
    })
  } catch {
    // Control-plane offline or DATABASE_URL not set — return empty gracefully
    return NextResponse.json({
      results: [],
      total: 0,
      stats: { bySource: {} },
      nextCursor: null,
    })
  }
}

export const dynamic = 'force-dynamic'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { CONTROL_PLANE_URL as CONTROL_PLANE } from '../../lib/env'

export async function GET(req: NextRequest) {
  const days = req.nextUrl.searchParams.get('days') ?? '7'

  try {
    const res = await fetch(`${CONTROL_PLANE}/api/cost-stats?days=${days}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(`control-plane responded ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    // Control-plane not running — return empty stats
    return NextResponse.json({
      sessions: [],
      tools: [],
      models: [],
      dailyTrend: [],
      totalCostUsd: 0,
      totalTokens: 0,
    })
  }
}

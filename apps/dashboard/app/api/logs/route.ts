import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const CONTROL_PLANE = process.env['CONTROL_PLANE_URL'] ?? 'http://localhost:3001'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const params = new URLSearchParams()
  for (const key of ['level', 'agentId', 'toolId', 'limit', 'since']) {
    const v = searchParams.get(key)
    if (v) params.set(key, v)
  }

  try {
    const res = await fetch(`${CONTROL_PLANE}/api/logs?${params.toString()}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) throw new Error(`control-plane responded ${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    // Control-plane not running — return empty
    return NextResponse.json({ logs: [], agents: [], tools: [] })
  }
}

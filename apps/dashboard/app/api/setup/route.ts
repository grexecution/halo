export const dynamic = 'force-dynamic'
/**
 * Proxy to control-plane /api/setup — keeps browser from calling
 * the internal Docker hostname directly.
 */
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

const CP = process.env['NEXT_PUBLIC_CONTROL_PLANE_URL'] ?? 'http://localhost:3001'

export async function GET() {
  try {
    const res = await fetch(`${CP}/api/setup`, { signal: AbortSignal.timeout(10_000) })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const res = await fetch(`${CP}/api/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }
}

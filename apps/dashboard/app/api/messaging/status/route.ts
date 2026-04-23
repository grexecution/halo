import { NextResponse } from 'next/server'
import { CONTROL_PLANE_URL } from '../../../lib/env'

export async function GET() {
  try {
    const res = await fetch(`${CONTROL_PLANE_URL}/api/messaging/status`, {
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return NextResponse.json({ bots: [] })
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ bots: [] })
  }
}

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { CONTROL_PLANE_URL } from '../../lib/env'

export async function POST() {
  try {
    const res = await fetch(`${CONTROL_PLANE_URL}/api/panic`, {
      method: 'POST',
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok)
      return NextResponse.json({ ok: false, error: 'control-plane error' }, { status: 502 })
    return NextResponse.json({ ok: true })
  } catch {
    // Control-plane unreachable — still acknowledge so UI updates
    return NextResponse.json({ ok: true, warning: 'control-plane unreachable' })
  }
}

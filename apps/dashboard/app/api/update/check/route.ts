export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { CONTROL_PLANE_URL as CP } from '../../../lib/env'

export async function GET() {
  try {
    const res = await fetch(`${CP}/api/update/check`, { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Update check failed' }, { status: 500 })
  }
}

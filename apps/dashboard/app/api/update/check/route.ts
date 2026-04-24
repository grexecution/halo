export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

const CP = process.env['NEXT_PUBLIC_CONTROL_PLANE_URL'] ?? 'http://localhost:3001'

export async function GET() {
  try {
    const res = await fetch(`${CP}/api/update/check`, { cache: 'no-store' })
    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Update check failed' }, { status: 500 })
  }
}

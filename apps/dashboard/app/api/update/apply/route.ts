export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'

const CP = process.env['NEXT_PUBLIC_CONTROL_PLANE_URL'] ?? 'http://localhost:3001'

export async function POST() {
  try {
    const res = await fetch(`${CP}/api/update/apply`, { method: 'POST' })

    // Forward streaming SSE response
    if (res.body) {
      return new NextResponse(res.body, {
        status: res.status,
        headers: {
          'Content-Type': res.headers.get('Content-Type') ?? 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }
}

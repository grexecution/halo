export const dynamic = 'force-dynamic'
/**
 * Proxy to control-plane /api/setup — keeps browser from calling
 * the internal Docker hostname directly.
 */
import type { NextRequest } from 'next/server'

import { CONTROL_PLANE_URL as CP } from '../../lib/env'
import { proxyFetch } from '../../lib/proxy'

export function GET() {
  return proxyFetch(`${CP}/api/setup`)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  return proxyFetch(`${CP}/api/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

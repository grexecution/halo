export const dynamic = 'force-dynamic'
/**
 * Dashboard skills API — proxy to control-plane /api/skills
 */
import type { NextRequest } from 'next/server'
import { CONTROL_PLANE_URL as CP } from '../../lib/env'
import { proxyFetch } from '../../lib/proxy'

export function GET() {
  return proxyFetch(`${CP}/api/skills`)
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  return proxyFetch(`${CP}/api/skills/new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

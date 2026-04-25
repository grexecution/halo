export const dynamic = 'force-dynamic'
import type { NextRequest } from 'next/server'
import { CONTROL_PLANE_URL as CP } from '../../../../lib/env'
import { proxyFetch } from '../../../../lib/proxy'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyFetch(`${CP}/api/skills/${id}/credentials`)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  return proxyFetch(`${CP}/api/skills/${id}/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

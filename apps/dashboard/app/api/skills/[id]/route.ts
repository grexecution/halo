export const dynamic = 'force-dynamic'
/**
 * Dashboard skills/[id] API — proxy to control-plane /api/skills/:name
 */
import type { NextRequest } from 'next/server'
import { CONTROL_PLANE_URL as CP } from '../../../lib/env'
import { proxyFetch } from '../../../lib/proxy'

const JSON_HEADERS = { 'Content-Type': 'application/json' }

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyFetch(`${CP}/api/skills/${id}`)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  return proxyFetch(`${CP}/api/skills/${id}`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return proxyFetch(`${CP}/api/skills/${id}`, { method: 'DELETE' })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  // Toggle vs full update
  const url =
    'enabled' in body && Object.keys(body).length === 1
      ? `${CP}/api/skills/${id}/toggle`
      : `${CP}/api/skills/${id}`
  return proxyFetch(url, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(body) })
}

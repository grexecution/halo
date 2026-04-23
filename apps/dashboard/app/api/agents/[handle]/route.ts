export const dynamic = 'force-dynamic'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { upsertAgent, deleteAgent } from '../store'
import type { Agent } from '../store'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const body = (await req.json()) as Agent
  const agent = upsertAgent({ ...body, handle })
  return NextResponse.json({ agent })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const body = (await req.json()) as Partial<Agent>
  const agent = upsertAgent({ handle, ...body } as Agent)
  return NextResponse.json({ agent })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params
  const ok = deleteAgent(handle)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

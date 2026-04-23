export const dynamic = 'force-dynamic'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getWorkspace, updateWorkspace, deleteWorkspace, indexWorkspaceToMemory } from '../store'
import type { Workspace } from '../store'
import { deleteMemory } from '../../memory/store'

export function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return params.then(({ id }) => {
    const ws = getWorkspace(id)
    if (!ws) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ workspace: ws })
  })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json()) as Partial<Workspace>
  const updated = updateWorkspace(id, body)
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  void indexWorkspaceToMemory(updated)
  return NextResponse.json({ workspace: updated })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ok = deleteWorkspace(id)
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  deleteMemory(`ws-${id}`)
  return NextResponse.json({ ok: true })
}

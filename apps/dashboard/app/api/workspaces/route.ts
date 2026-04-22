import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { listWorkspaces, createWorkspace, indexWorkspaceToMemory } from './store'
import type { Workspace } from './store'

export function GET() {
  const workspaces = listWorkspaces()
  return NextResponse.json({ workspaces })
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<Workspace>
  const now = new Date().toISOString()
  const ws: Workspace = {
    id: `ws-${Date.now()}`,
    name: body.name ?? 'Untitled',
    type: body.type ?? 'custom',
    description: body.description ?? '',
    emoji: body.emoji ?? '📁',
    fields: body.fields ?? [],
    active: body.active ?? false,
    createdAt: now,
    updatedAt: now,
  }
  createWorkspace(ws)
  await indexWorkspaceToMemory(ws)
  return NextResponse.json({ workspace: ws }, { status: 201 })
}

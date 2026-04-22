import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { listWorkspaces, createWorkspace } from './store'
import type { Workspace } from './store'
import { upsertMemory } from '../memory/store'

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
  indexWorkspaceToMemory(ws)
  return NextResponse.json({ workspace: ws }, { status: 201 })
}

export function indexWorkspaceToMemory(ws: Workspace) {
  const lines = [`Workspace: ${ws.name} (${ws.type})`]
  if (ws.description) lines.push(`Description: ${ws.description}`)
  for (const f of ws.fields) {
    if (f.value && f.type !== 'secret') lines.push(`${f.key}: ${f.value}`)
  }
  upsertMemory({
    id: `ws-${ws.id}`,
    content: lines.join('\n'),
    source: 'workspace',
    sourceId: ws.id,
    type: 'workspace_context',
    tags: [ws.name, ws.type],
    metadata: { workspaceId: ws.id, workspaceName: ws.name },
    createdAt: ws.createdAt,
    updatedAt: ws.updatedAt,
  })
}

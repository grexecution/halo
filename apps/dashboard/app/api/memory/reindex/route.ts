import { NextResponse } from 'next/server'
import { getActiveWorkspaces } from '../../workspaces/store'
import { upsertMemory } from '../store'

export async function POST() {
  try {
    const workspaces = getActiveWorkspaces()
    for (const ws of workspaces) {
      const lines = [`Workspace: ${ws.name} (${ws.type})`]
      if (ws.description) lines.push(`Description: ${ws.description}`)
      for (const f of ws.fields) {
        if (f.value && f.type !== 'secret') lines.push(`${f.key}: ${f.value}`)
      }
      await upsertMemory({
        id: `ws-${ws.id}`,
        content: lines.join('\n'),
        source: 'workspace',
        sourceId: ws.id,
        type: 'workspace_context',
        tags: [ws.name, ws.type],
        metadata: { workspaceId: ws.id, workspaceName: ws.name },
        createdAt: ws.createdAt,
        updatedAt: new Date().toISOString(),
      })
    }
    return NextResponse.json({ ok: true, indexed: workspaces.length })
  } catch (e) {
    return NextResponse.json(
      { error: `Reindex failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    )
  }
}

import { getDb } from '../../lib/db'
import { getMemory } from '../../lib/memory'
import { upsertMemory } from '../memory/store'

export type WorkspaceType = 'client' | 'personal' | 'project' | 'team' | 'custom'
export type FieldType = 'text' | 'url' | 'code' | 'secret'

export interface WorkspaceField {
  id: string
  key: string
  value: string
  type: FieldType
}

export interface WorkspaceDocument {
  id: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface Workspace {
  id: string
  name: string
  type: WorkspaceType
  description: string
  emoji: string
  fields: WorkspaceField[]
  documents: WorkspaceDocument[]
  active: boolean
  createdAt: string
  updatedAt: string
}

interface WsRow {
  id: string
  name: string
  type: string
  description: string
  emoji: string
  active: number
  created_at: string
  updated_at: string
}
interface FldRow {
  id: string
  workspace_id: string
  key_name: string
  value: string
  field_type: string
  sort_order: number
}
interface DocRow {
  id: string
  workspace_id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

function toWorkspace(row: WsRow, fields: FldRow[], docs: DocRow[]): Workspace {
  return {
    id: row.id,
    name: row.name,
    type: row.type as WorkspaceType,
    description: row.description,
    emoji: row.emoji,
    fields: fields.map((f) => ({
      id: f.id,
      key: f.key_name,
      value: f.value,
      type: f.field_type as FieldType,
    })),
    documents: docs.map((d) => ({
      id: d.id,
      title: d.title,
      content: d.content,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    })),
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function loadFields(id: string): FldRow[] {
  return getDb()
    .prepare('SELECT * FROM workspace_fields WHERE workspace_id = ? ORDER BY sort_order ASC')
    .all(id) as FldRow[]
}

function loadDocs(id: string): DocRow[] {
  return getDb()
    .prepare('SELECT * FROM workspace_documents WHERE workspace_id = ? ORDER BY created_at ASC')
    .all(id) as DocRow[]
}

function saveFields(workspaceId: string, fields: WorkspaceField[]) {
  const db = getDb()
  db.prepare('DELETE FROM workspace_fields WHERE workspace_id = ?').run(workspaceId)
  const stmt = db.prepare(
    'INSERT INTO workspace_fields (id, workspace_id, key_name, value, field_type, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
  )
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i]!
    stmt.run(f.id, workspaceId, f.key, f.value, f.type, i)
  }
}

function saveDocs(workspaceId: string, docs: WorkspaceDocument[]) {
  const db = getDb()
  db.prepare('DELETE FROM workspace_documents WHERE workspace_id = ?').run(workspaceId)
  const stmt = db.prepare(
    'INSERT INTO workspace_documents (id, workspace_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
  const now = new Date().toISOString()
  for (const d of docs) {
    stmt.run(d.id, workspaceId, d.title, d.content, d.createdAt || now, d.updatedAt || now)
  }
}

export function listWorkspaces(): Workspace[] {
  const rows = getDb().prepare('SELECT * FROM workspaces ORDER BY created_at DESC').all() as WsRow[]
  return rows.map((r) => toWorkspace(r, loadFields(r.id), loadDocs(r.id)))
}

export function getWorkspace(id: string): Workspace | undefined {
  const row = getDb().prepare('SELECT * FROM workspaces WHERE id = ?').get(id) as WsRow | undefined
  if (!row) return undefined
  return toWorkspace(row, loadFields(id), loadDocs(id))
}

export function createWorkspace(ws: Workspace): Workspace {
  const db = getDb()
  db.prepare(
    'INSERT INTO workspaces (id, name, type, description, emoji, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).run(
    ws.id,
    ws.name,
    ws.type,
    ws.description,
    ws.emoji,
    ws.active ? 1 : 0,
    ws.createdAt,
    ws.updatedAt,
  )
  saveFields(ws.id, ws.fields)
  saveDocs(ws.id, ws.documents ?? [])
  return ws
}

export function updateWorkspace(id: string, patch: Partial<Workspace>): Workspace | null {
  const existing = getWorkspace(id)
  if (!existing) return null
  const updated: Workspace = { ...existing, ...patch, id, updatedAt: new Date().toISOString() }
  const db = getDb()
  db.prepare(
    'UPDATE workspaces SET name=?, type=?, description=?, emoji=?, active=?, updated_at=? WHERE id=?',
  ).run(
    updated.name,
    updated.type,
    updated.description,
    updated.emoji,
    updated.active ? 1 : 0,
    updated.updatedAt,
    id,
  )
  saveFields(id, updated.fields)
  saveDocs(id, updated.documents ?? [])
  return updated
}

export function deleteWorkspace(id: string): boolean {
  const result = getDb().prepare('DELETE FROM workspaces WHERE id = ?').run(id)
  return result.changes > 0
}

export function getActiveWorkspaces(): Workspace[] {
  const rows = getDb()
    .prepare('SELECT * FROM workspaces WHERE active = 1 ORDER BY created_at DESC')
    .all() as WsRow[]
  return rows.map((r) => toWorkspace(r, loadFields(r.id), loadDocs(r.id)))
}

function buildWorkspaceContent(ws: Workspace): string {
  const lines: string[] = [`# Workspace: ${ws.name} (${ws.type})`]
  if (ws.description) lines.push(`> ${ws.description}`)
  lines.push('')

  const visibleFields = ws.fields.filter((f) => f.value && f.type !== 'secret')
  if (visibleFields.length > 0) {
    lines.push('## Configuration')
    for (const f of visibleFields) lines.push(`- **${f.key}**: ${f.value}`)
    lines.push('')
  }

  for (const doc of ws.documents ?? []) {
    if (!doc.content.trim()) continue
    lines.push(`## ${doc.title}`)
    lines.push(doc.content.trim())
    lines.push('')
  }

  return lines.join('\n').trim()
}

export async function indexWorkspaceToMemory(ws: Workspace): Promise<void> {
  const content = buildWorkspaceContent(ws)
  const now = new Date().toISOString()

  // 1. Keyword-searchable fallback in app.db
  await upsertMemory({
    id: `ws-${ws.id}`,
    content,
    source: 'workspace',
    sourceId: ws.id,
    type: 'workspace_context',
    tags: [ws.name, ws.type],
    metadata: { workspaceId: ws.id, workspaceName: ws.name },
    createdAt: ws.createdAt,
    updatedAt: now,
  })

  // 2. Vector-embedded in Mastra memory.db — workspace gets its own thread so it's
  //    surfaced via otherThreadsContext when a chat query is semantically related.
  const memory = getMemory()
  const threadId = `workspace-${ws.id}`
  void memory
    .saveThread({
      thread: {
        id: threadId,
        title: `Workspace: ${ws.name}`,
        resourceId: 'default',
        createdAt: new Date(ws.createdAt),
        updatedAt: new Date(now),
        metadata: { workspaceType: ws.type, workspaceName: ws.name },
      },
    })
    .then(() =>
      memory.saveMessages({
        messages: [
          {
            id: `ws-content-${ws.id}`,
            role: 'system',
            createdAt: new Date(now),
            threadId,
            resourceId: 'default',
            content: { format: 2, parts: [{ type: 'text', text: content }] },
          },
        ],
      }),
    )
    .catch(() => {
      // best-effort — manual memories are the ground truth
    })
}

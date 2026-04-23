export const dynamic = 'force-dynamic'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getDb } from '../../lib/db'

export interface KnowledgeDoc {
  id: string
  title: string
  sourceType: 'upload' | 'url' | 'paste'
  sourceUrl: string | null
  content: string
  chunkCount: number
  status: 'pending' | 'processing' | 'ready' | 'error'
  workspaceId: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
}

interface DocRow {
  id: string
  title: string
  source_type: string
  source_url: string | null
  content: string
  chunk_count: number
  status: string
  workspace_id: string | null
  tags: string
  created_at: string
  updated_at: string
}

function toDoc(row: DocRow): KnowledgeDoc {
  return {
    id: row.id,
    title: row.title,
    sourceType: row.source_type as KnowledgeDoc['sourceType'],
    sourceUrl: row.source_url,
    content: row.content,
    chunkCount: row.chunk_count,
    status: row.status as KnowledgeDoc['status'],
    workspaceId: row.workspace_id,
    tags: JSON.parse(row.tags || '[]') as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const workspaceId = searchParams.get('workspaceId')
  const db = getDb()
  const rows = workspaceId
    ? (db
        .prepare('SELECT * FROM knowledge_docs WHERE workspace_id = ? ORDER BY created_at DESC')
        .all(workspaceId) as DocRow[])
    : (db
        .prepare('SELECT * FROM knowledge_docs ORDER BY created_at DESC LIMIT 200')
        .all() as DocRow[])
  return NextResponse.json({ docs: rows.map(toDoc) })
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    title?: string
    sourceType?: string
    sourceUrl?: string
    content?: string
    workspaceId?: string
    tags?: string[]
  }

  if (!body.content && !body.sourceUrl) {
    return NextResponse.json({ error: 'content or sourceUrl required' }, { status: 400 })
  }

  const id = `kdoc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const title = body.title ?? (body.sourceUrl ? new URL(body.sourceUrl).hostname : 'Untitled')
  const content = body.content ?? ''

  // Simple chunking: count ~500-char chunks
  const chunkCount = Math.max(1, Math.ceil(content.length / 500))

  const db = getDb()
  db.prepare(
    `INSERT INTO knowledge_docs (id, title, source_type, source_url, content, chunk_count, status, workspace_id, tags)
     VALUES (?, ?, ?, ?, ?, ?, 'ready', ?, ?)`,
  ).run(
    id,
    title,
    body.sourceType ?? 'paste',
    body.sourceUrl ?? null,
    content,
    chunkCount,
    body.workspaceId ?? null,
    JSON.stringify(body.tags ?? []),
  )

  // Also upsert into memories table so the agent can recall it
  const memId = `mem-kdoc-${id}`
  db.prepare(
    `INSERT INTO memories (id, content, source, source_id, type, tags, metadata, created_at, updated_at)
     VALUES (?, ?, 'knowledge', ?, 'document', ?, '{}', datetime('now'), datetime('now'))
     ON CONFLICT(id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at`,
  ).run(memId, content.slice(0, 4000), id, JSON.stringify(body.tags ?? []))

  const row = db.prepare('SELECT * FROM knowledge_docs WHERE id = ?').get(id) as DocRow
  return NextResponse.json(toDoc(row), { status: 201 })
}
